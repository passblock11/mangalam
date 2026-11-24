import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:phonepe_payment_sdk/phonepe_payment_sdk.dart';

import '../l10n/app_locale.dart';
import '../ui/core/mangalam_theme.dart';
import 'api_client.dart';
import 'payment_messages.dart';

/// PhonePe Standard Checkout. Secrets never leave the server.
class PhonePeCheckout {
  PhonePeCheckout(this._api);

  final ApiClient _api;

  Future<bool> buyPlan(BuildContext context, String planCode, {required bool subscription}) async {
    String merchantOrderId = '';
    String merchantSubscriptionId = '';
    try {
      final Map<String, dynamic> started;
      try {
        started = (subscription
                ? await _api.post('/v1/payments/phonepe/subscribe', {
                    'plan_code': planCode,
                    'channel': 'app',
                  })
                : await _api.post('/v1/payments/phonepe/order', {
                    'plan_code': planCode,
                    'channel': 'app',
                  }))
            as Map<String, dynamic>;
      } on ApiException catch (e) {
        if (subscription && e.statusCode == 409) {
          final recovered = await _recoverSubscriptionPayment(
            merchantOrderId: merchantOrderId,
            merchantSubscriptionId: merchantSubscriptionId,
          );
          if (recovered) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(t('Payment successful — your plan is now active'))),
              );
            }
            return true;
          }
        }
        rethrow;
      }

      if (started['membership_ready'] == true) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(t('Payment successful — your plan is now active'))),
          );
        }
        return true;
      }

      final environment = _requiredEnvironment(started['environment']);
      final merchantId = started['merchant_id']?.toString() ?? '';
      merchantOrderId = started['merchant_order_id']?.toString() ?? '';
      merchantSubscriptionId = started['merchant_subscription_id']?.toString() ?? '';
      final orderId = started['order_id']?.toString() ?? '';
      final token = started['token']?.toString() ?? '';
      if (merchantId.isEmpty || merchantOrderId.isEmpty || orderId.isEmpty || token.isEmpty) {
        throw Exception('Payment could not be started.');
      }

      final flowId = merchantOrderId.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
      final initialized = await PhonePePaymentSdk.init(
        environment == 'production' ? 'PRODUCTION' : 'SANDBOX',
        merchantId,
        flowId.isEmpty ? merchantOrderId : flowId,
        false,
      );
      if (initialized != true) {
        throw Exception('Payment could not be started.');
      }

      final request = jsonEncode({
        'orderId': orderId,
        'merchantId': merchantId,
        'token': token,
        'paymentMode': {'type': 'PAY_PAGE'},
      });

      const appSchema = 'com.mangalam.mangalamapp';
      final response = await PhonePePaymentSdk.startTransaction(request, appSchema);
      final status = response?['status']?.toString().toUpperCase() ?? '';
      if (status == 'FAILURE' || status == 'INTERRUPTED') {
        final error = response?['error']?.toString();
        throw Exception(
          (error != null && error.isNotEmpty && error != 'null') ? error : 'Payment was closed.',
        );
      }

      if (!context.mounted) return false;
      await _withConfirmingDialog(
        context,
        () async {
          if (subscription) {
            await _verifySubscriptionWithRetry(
              merchantOrderId: merchantOrderId,
              merchantSubscriptionId: merchantSubscriptionId,
            );
          } else {
            await _verifyWithRetry(merchantOrderId);
          }
        },
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Payment successful — your plan is now active'))),
        );
      }
      return true;
    } catch (error) {
      if (subscription && merchantSubscriptionId.isNotEmpty) {
        final recovered = await _recoverSubscriptionPayment(
          merchantOrderId: merchantOrderId,
          merchantSubscriptionId: merchantSubscriptionId,
        );
        if (recovered) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(t('Payment successful — your plan is now active'))),
            );
          }
          return true;
        }
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t(friendlyPaymentMessage(error)))),
        );
      }
      return false;
    }
  }

  Future<void> _withConfirmingDialog(BuildContext context, Future<void> Function() work) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (ctx) => PopScope(
        canPop: false,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: MangalamTheme.maroon),
              const SizedBox(height: 14),
              Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                  child: Text(
                    t('Confirming your payment…'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: MangalamTheme.ink, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    try {
      await work();
    } finally {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }
  }

  Future<bool> _recoverSubscriptionPayment({
    required String merchantOrderId,
    required String merchantSubscriptionId,
  }) async {
    for (var attempt = 0; attempt < 8; attempt++) {
      if (await _membershipActive()) return true;
      try {
        await _api.post('/v1/payments/phonepe/confirm-pending', {});
        if (await _membershipActive()) return true;
      } catch (_) {}
      try {
        await _api.post('/v1/payments/phonepe/verify-subscription', {
          if (merchantOrderId.isNotEmpty) 'merchant_order_id': merchantOrderId,
          if (merchantSubscriptionId.isNotEmpty) 'merchant_subscription_id': merchantSubscriptionId,
        });
        return true;
      } catch (_) {}
      if (attempt < 7) {
        await Future<void>.delayed(Duration(milliseconds: 900 + attempt * 700));
      }
    }
    return _membershipActive();
  }

  Future<bool> _membershipActive() async {
    try {
      final json = await _api.get('/v1/payments/membership') as Map<String, dynamic>;
      if (json['membership_waived'] == true) return true;
      if (json['benefits_active'] == true || json['addons_allowed'] == true) return true;
      final until = DateTime.tryParse(json['premium_until']?.toString() ?? '');
      if (until != null && until.isAfter(DateTime.now())) return true;
    } catch (_) {}
    return false;
  }

  Future<void> _verifySubscriptionWithRetry({
    required String merchantOrderId,
    required String merchantSubscriptionId,
    int maxAttempts = 6,
  }) async {
    Object? last;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await _api.post('/v1/payments/phonepe/verify-subscription', {
          if (merchantOrderId.isNotEmpty) 'merchant_order_id': merchantOrderId,
          if (merchantSubscriptionId.isNotEmpty) 'merchant_subscription_id': merchantSubscriptionId,
        });
        return;
      } catch (error) {
        last = error;
        if (await _membershipActive()) return;
        final message = error.toString().toLowerCase();
        final permanent =
            message.contains('not a phonepe subscription') ||
            message.contains('does not belong') ||
            message.contains('missing mangalam') ||
            message.contains('missing phonepe subscription details') ||
            message.contains('do not pay again');
        if (permanent) rethrow;
        final pending =
            message.contains('not confirmed') ||
            message.contains('not active yet') ||
            message.contains('not confirmed yet') ||
            message.contains('setup is not confirmed');
        if (!pending || attempt == maxAttempts - 1) rethrow;
        await Future<void>.delayed(Duration(milliseconds: 800 + attempt * 600));
      }
    }
    if (last != null) throw last;
  }

  Future<void> _verifyWithRetry(String merchantOrderId) async {
    Object? last;
    for (var attempt = 0; attempt < 6; attempt++) {
      try {
        await _api.post('/v1/payments/phonepe/verify', {
          'merchant_order_id': merchantOrderId,
        });
        return;
      } catch (error) {
        last = error;
        final message = error.toString().toLowerCase();
        final pending = message.contains('not confirmed yet') || message.contains('not confirmed');
        if (!pending || attempt == 5) rethrow;
        await Future<void>.delayed(Duration(milliseconds: 800 + attempt * 600));
      }
    }
    if (last != null) throw last;
  }

  String _requiredEnvironment(Object? value) {
    final name = value?.toString() ?? '';
    if (name == 'production' || name == 'sandbox') return name;
    throw Exception('Payment could not be started.');
  }
}