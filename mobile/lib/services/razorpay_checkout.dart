import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api_client.dart';
import '../ui/core/mangalam_theme.dart';

/// Server-driven Razorpay flow using admin-managed plans:
/// fetch plans → pick → create order → native checkout → verify & credit wallet.
class RazorpayCheckout {
  final Razorpay _razorpay = Razorpay();
  final _api = ApiClient();

  void dispose() {
    _razorpay.clear();
  }

  /// Opens the plan picker, then Razorpay. Returns `true` if payment verified.
  Future<bool> rechargeContactCredits(BuildContext context) async {
    // 1. Fetch admin-managed plans
    List<Map<String, dynamic>> plans = [];
    try {
      final res = await _api.get('/v1/config/plans') as Map<String, dynamic>;
      plans = (res['plans'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      // ignore — fall back to empty
    }

    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _PlanPickerSheet(plans: plans),
    );
    if (selected == null || !context.mounted) return false;

    final planCode = selected['code']?.toString();
    final planName = selected['name']?.toString() ?? 'Mangalam plan';
    final amountPaise = selected['price_paise'];
    if (planCode == null || amountPaise == null) return false;

    final completer = Completer<PaymentSuccessResponse>();
    void onSuccess(PaymentSuccessResponse r) {
      if (!completer.isCompleted) completer.complete(r);
    }

    void onError(PaymentFailureResponse r) {
      if (!completer.isCompleted) {
        completer.completeError(Exception(r.message ?? r.code ?? 'Payment failed'));
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
        'plan_code': planCode,
      }) as Map<String, dynamic>;

      final keyId = order['key_id'] as String?;
      final orderId = order['order_id'] as String?;
      final currency = order['currency'] as String? ?? 'INR';
      if (keyId == null || orderId == null) {
        throw Exception('Invalid order response');
      }

      final user = Supabase.instance.client.auth.currentUser;
      final opts = {
        'key': keyId,
        'amount': order['amount_paise'] ?? amountPaise,
        'currency': currency,
        'name': 'Mangalam',
        'description': planName,
        'order_id': orderId,
        'prefill': {
          if (user?.email != null && user!.email!.isNotEmpty) 'email': user.email,
          if (user?.phone != null && user!.phone!.isNotEmpty) 'contact': user.phone,
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
          const SnackBar(content: Text('Payment successful — your plan is now active')),
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

class _PlanPickerSheet extends StatelessWidget {
  const _PlanPickerSheet({required this.plans});

  final List<Map<String, dynamic>> plans;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Choose a plan',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            const Text(
              'Payments are processed securely by Razorpay.',
              style: TextStyle(color: MangalamTheme.muted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            if (plans.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  'No plans are available right now. Please check back later or contact support.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: MangalamTheme.muted),
                ),
              )
            else
              ...plans.map((p) {
                final name = p['name']?.toString() ?? 'Plan';
                final desc = p['description']?.toString();
                final price = (p['price_paise'] as num?)?.toInt() ?? 0;
                final type = p['plan_type']?.toString() ?? 'credits';
                final credits = (p['credits'] as num?)?.toInt() ?? 0;
                final days = (p['duration_days'] as num?)?.toInt() ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => Navigator.pop(context, p),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFE7E2DC)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: MangalamTheme.gold.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Iconsax.crown, color: MangalamTheme.gold, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                                if (desc != null && desc.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(desc,
                                        style: const TextStyle(fontSize: 12, color: MangalamTheme.muted)),
                                  ),
                                const SizedBox(height: 4),
                                Wrap(
                                  spacing: 6,
                                  children: [
                                    _chip(type),
                                    if (credits > 0) _chip('$credits credits'),
                                    if (days > 0) _chip('$days days premium'),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            '₹${(price / 100).toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                              color: MangalamTheme.maroon,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: MangalamTheme.maroon.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: MangalamTheme.maroon)),
    );
  }
}
