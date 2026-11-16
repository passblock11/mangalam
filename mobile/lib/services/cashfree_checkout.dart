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
        final done = await _openSubscription(
          environment: _requiredEnvironment(started['environment']),
          subscriptionId: started['subscription_id']?.toString() ?? '',
          sessionId: started['subscription_session_id']?.toString() ?? '',
        );
        if (!done) return false;
        await _verifyWithRetry(
          '/v1/payments/cashfree/verify-subscription',
          {'subscription_id': started['subscription_id']},
        );
      } else {
        final order = await _api.post('/v1/payments/cashfree/order', {
          'plan_code': planCode,
        }) as Map<String, dynamic>;
        final done = await _openOrder(
          environment: _requiredEnvironment(order['environment']),
          orderId: order['order_id']?.toString() ?? '',
          sessionId: order['payment_session_id']?.toString() ?? '',
        );
        if (!done) return false;
        await _verifyWithRetry(
          '/v1/payments/cashfree/verify',
          {'order_id': order['order_id']},
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
    final done = Completer<bool>();
    _gateway.setCallback((_) {
      if (!done.isCompleted) done.complete(true);
    }, (CFErrorResponse error, String _) {
      if (!done.isCompleted) done.completeError(Exception(error.getMessage() ?? 'Payment was closed.'));
    });
    final session = CFSessionBuilder()
        .setEnvironment(_env(environment))
        .setOrderId(orderId)
        .setPaymentSessionId(sessionId)
        .build();
    _gateway.doPayment(CFWebCheckoutPaymentBuilder().setSession(session).build());
    return done.future.timeout(const Duration(minutes: 15));
  }

  Future<bool> _openSubscription({
    required String environment,
    required String subscriptionId,
    required String sessionId,
  }) {
    final done = Completer<bool>();
    _gateway.setCallback((_) {
      if (!done.isCompleted) done.complete(true);
    }, (CFErrorResponse error, String _) {
      if (!done.isCompleted) done.completeError(Exception(error.getMessage() ?? 'Payment was closed.'));
    });
    final session = CFSubscriptionSessionBuilder()
        .setEnvironment(_env(environment))
        .setSubscriptionId(subscriptionId)
        .setSubscriptionSessionId(sessionId)
        .build();
    _gateway.doPayment(CFSubscriptionPaymentBuilder().setSession(session).build());
    return done.future.timeout(const Duration(minutes: 15));
  }
}
