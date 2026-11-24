import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_cashfree_pg_sdk/api/cferrorresponse/cferrorresponse.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfsubscriptioncheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfwebcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsubssession.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';

import '../l10n/app_locale.dart';
import 'api_client.dart';

/// Cashfree checkout. The secret key never leaves the server.
class CashfreeCheckout {
  CashfreeCheckout(this._api);

  final ApiClient _api;
  final _gateway = CFPaymentGatewayService();

  Future<bool> buyPlan(BuildContext context, String planCode, {required bool subscription}) async {
    try {
      if (subscription) {
        final started = await _api.post('/v1/payments/cashfree/subscribe', {
          'plan_code': planCode,
        }) as Map<String, dynamic>;
        final subscriptionId = started['subscription_id']?.toString() ?? '';
        final done = await _openSubscription(
          environment: _requiredEnvironment(started['environment']),
          subscriptionId: subscriptionId,
          sessionId: started['subscription_session_id']?.toString() ?? '',
        );
        if (!done) return false;
        await _verifyWithRetry(
          '/v1/payments/cashfree/verify-subscription',
          {'subscription_id': subscriptionId},
        );
      } else {
        final order = await _api.post('/v1/payments/cashfree/order', {
          'plan_code': planCode,
        }) as Map<String, dynamic>;
        final orderId = order['order_id']?.toString() ?? '';
        final done = await _openOrder(
          environment: _requiredEnvironment(order['environment']),
          orderId: orderId,
          sessionId: order['payment_session_id']?.toString() ?? '',
        );
        if (!done) return false;
        await _verifyWithRetry(
          '/v1/payments/cashfree/verify',
          {'order_id': orderId},
        );
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Payment successful — your plan is now active'))),
        );
      }
      return true;
    } catch (error) {
      if (context.mounted) {
        final message = error.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t(message))));
      }
      return false;
    }
  }

  /// Cashfree can still show AUTHORIZED briefly after the SDK success callback.
  Future<void> _verifyWithRetry(String path, Map<String, dynamic> body) async {
    Object? last;
    for (var attempt = 0; attempt < 5; attempt++) {
      try {
        await _api.post(path, body);
        return;
      } catch (error) {
        last = error;
        final message = error.toString().toLowerCase();
        final pending = message.contains('not confirmed yet') || message.contains('not confirmed');
        if (!pending || attempt == 4) rethrow;
        await Future<void>.delayed(Duration(seconds: 1 + attempt));
      }
    }
    if (last != null) throw last;
  }

  String _requiredEnvironment(Object? value) {
    final name = value?.toString() ?? '';
    if (name == 'production' || name == 'sandbox') return name;
    throw Exception('Payment could not be started.');
  }

  CFEnvironment _env(String name) {
    if (name == 'production') return CFEnvironment.PRODUCTION;
    if (name == 'sandbox') return CFEnvironment.SANDBOX;
    throw Exception('Payment could not be started.');
  }

  Future<bool> _openOrder({
    required String environment,
    required String orderId,
    required String sessionId,
  }) {
    return _awaitCheckout(
      start: () {
        final session = CFSessionBuilder()
            .setEnvironment(_env(environment))
            .setOrderId(orderId)
            .setPaymentSessionId(sessionId)
            .build();
        _gateway.doPayment(CFWebCheckoutPaymentBuilder().setSession(session).build());
      },
      verifyPath: '/v1/payments/cashfree/verify',
      verifyBody: {'order_id': orderId},
    );
  }

  Future<bool> _openSubscription({
    required String environment,
    required String subscriptionId,
    required String sessionId,
  }) {
    return _awaitCheckout(
      start: () {
        final session = CFSubscriptionSessionBuilder()
            .setEnvironment(_env(environment))
            .setSubscriptionId(subscriptionId)
            .setSubscriptionSessionId(sessionId)
            .build();
        _gateway.doPayment(CFSubscriptionPaymentBuilder().setSession(session).build());
      },
      verifyPath: '/v1/payments/cashfree/verify-subscription',
      verifyBody: {'subscription_id': subscriptionId},
    );
  }

  /// Wait for the Cashfree SDK callback, and also poll the server after the
  /// user returns from UPI so a missing native callback cannot leave the
  /// membership screen spinning forever.
  Future<bool> _awaitCheckout({
    required void Function() start,
    required String verifyPath,
    required Map<String, dynamic> verifyBody,
  }) async {
    final done = Completer<bool>();
    Timer? poll;
    _ResumeObserver? resume;

    void finishOk() {
      if (!done.isCompleted) done.complete(true);
    }

    void finishErr(Object error) {
      if (!done.isCompleted) done.completeError(error);
    }

    Future<void> tryVerify() async {
      if (done.isCompleted) return;
      try {
        await _api.post(verifyPath, verifyBody);
        finishOk();
      } catch (_) {
        // Still pending at the gateway — keep waiting for callback / next poll.
      }
    }

    _gateway.setCallback((_) {
      finishOk();
    }, (CFErrorResponse error, String _) {
      finishErr(Exception(error.getMessage() ?? 'Payment was closed.'));
    });

    start();

    // After UPI redirect, the SDK callback is unreliable. Poll once the app
    // is likely back, and again every few seconds while we wait.
    poll = Timer.periodic(const Duration(seconds: 3), (_) {
      unawaited(tryVerify());
    });
    resume = _ResumeObserver(() {
      unawaited(tryVerify());
    });
    WidgetsBinding.instance.addObserver(resume);

    try {
      return await done.future.timeout(const Duration(minutes: 15));
    } finally {
      poll.cancel();
      WidgetsBinding.instance.removeObserver(resume);
    }
  }
}

class _ResumeObserver with WidgetsBindingObserver {
  _ResumeObserver(this.onResume);

  final VoidCallback onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) onResume();
  }
}
