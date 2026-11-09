import 'dart:async';

import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api_client.dart';

/// Server-driven Razorpay flow: create order → native checkout → verify & credit wallet.
class RazorpayCheckout {
  final Razorpay _razorpay = Razorpay();
  final _api = ApiClient();

  void dispose() {
    _razorpay.clear();
  }

  /// Opens amount picker, then Razorpay. Returns `true` if payment verified and credits applied.
  Future<bool> rechargeContactCredits(BuildContext context) async {
    final credits = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Recharge contact credits',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  'Choose how many credits to add. Payment is processed by Razorpay.',
                  style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 16),
                for (final n in [10, 25, 50])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, n),
                      child: Text('$n credits'),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
    if (credits == null || !context.mounted) return false;

    final completer = Completer<PaymentSuccessResponse>();
    void onSuccess(PaymentSuccessResponse r) {
      if (!completer.isCompleted) completer.complete(r);
    }

    void onError(PaymentFailureResponse r) {
      if (!completer.isCompleted) {
        completer.completeError(
          Exception(r.message ?? r.code ?? 'Payment failed'),
        );
      }
    }

    void onExternal(ExternalWalletResponse r) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('External wallet: ${r.walletName}')),
      );
    }

    _razorpay.clear();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, onError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, onExternal);

    try {
      final order = await _api.post('/v1/payments/razorpay/order', {
        'credits': credits,
      }) as Map<String, dynamic>;

      final keyId = order['key_id'] as String?;
      final orderId = order['order_id'] as String?;
      final amountPaise = order['amount_paise'];
      final currency = order['currency'] as String? ?? 'INR';
      if (keyId == null || orderId == null) {
        throw Exception('Invalid order response');
      }

      final user = Supabase.instance.client.auth.currentUser;
      final opts = {
        'key': keyId,
        'amount': amountPaise,
        'currency': currency,
        'name': 'Mangalam',
        'description': '$credits contact credits',
        'order_id': orderId,
        'prefill': {
          if (user?.phone != null && user!.phone!.isNotEmpty)
            'contact': user.phone,
        },
        'external': {
          'wallets': ['paytm'],
        },
      };

      _razorpay.open(opts);

      final res = await completer.future.timeout(
        const Duration(minutes: 15),
        onTimeout: () => throw TimeoutException('Payment was not completed'),
      );

      if (!context.mounted) return false;

      await _api.post('/v1/payments/razorpay/verify', {
        'razorpay_order_id': res.orderId,
        'razorpay_payment_id': res.paymentId,
        'razorpay_signature': res.signature,
      });

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Contact credits added')),
        );
      }
      return true;
    } on TimeoutException catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment timed out')),
        );
      }
      return false;
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
      return false;
    } finally {
      _razorpay.clear();
    }
  }
}
