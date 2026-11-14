import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../l10n/app_locale.dart';
import 'app_branding.dart';
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

  /// Contact-credit packs only. Membership is a separate recurring checkout.
  Future<bool> rechargeContactCredits(BuildContext context) {
    return _openPlans(context, membership: false);
  }

  /// Recurring membership, or a one-time premium plan. Not a credit pack.
  Future<bool> buyMembership(BuildContext context) {
    return _openPlans(context, membership: true);
  }

  Future<bool> _openPlans(
    BuildContext context, {
    required bool membership,
  }) async {
    List<Map<String, dynamic>> plans = [];
    try {
      final res = await _api.get('/v1/config/plans') as Map<String, dynamic>;
      final all =
          (res['plans'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      plans = all.where((p) {
        final type = p['plan_type']?.toString() ?? 'credits';
        if (membership) return type == 'subscription' || type == 'one_time';
        return type == 'credits';
      }).toList();
    } catch (_) {
      // ignore — fall back to empty
    }

    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => _PlanPickerSheet(
        plans: plans,
        title: membership ? 'Choose a membership' : 'Buy contact credits',
        subtitle: membership
            ? 'Membership renews by UPI or card until you cancel. You keep access until the date you already paid for.'
            : 'Credit packs are a one-time add-on. They do not renew.',
      ),
    );
    if (selected == null || !context.mounted) return false;

    final planCode = selected['code']?.toString();
    final planName = selected['name']?.toString() ?? 'Mangalam plan';
    final amountPaise = selected['price_paise'];
    if (planCode == null || amountPaise == null) return false;
    if (selected['plan_type']?.toString() == 'subscription') {
      return _startSubscription(context, planCode, planName);
    }

    final completer = Completer<PaymentSuccessResponse>();
    void onSuccess(PaymentSuccessResponse r) {
      if (!completer.isCompleted) completer.complete(r);
    }

    void onError(PaymentFailureResponse r) {
      if (!completer.isCompleted) {
        // Razorpay fires EVENT_PAYMENT_ERROR when the user dismisses the
        // checkout (numeric code 2 = PAYMENT_CANCELLED) and for real
        // failures. Map to a typed message — never leak "Exception: Undefined".
        final code = r.code?.toString() ?? '';
        final message = (r.message ?? '').toString();
        completer.completeError(_PaymentCancelException(code, message));
      }
    }

    void onExternal(ExternalWalletResponse r) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tf('External wallet: {name}', {'name': r.walletName ?? ''}))),
      );
    }

    _razorpay.clear();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, onError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, onExternal);

    try {
      // Loader while the order is created (proxy round-trip can take ~1–2s).
      if (context.mounted) {
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          useRootNavigator: true,
          builder: (ctx) => const PopScope(
            canPop: false,
            child: Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            ),
          ),
        );
      }
      Map<String, dynamic> order;
      try {
        order = await _api.post('/v1/payments/razorpay/order', {
              'plan_code': planCode,
            }) as Map<String, dynamic>;
      } finally {
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
        }
      }

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
        'name': AppBranding.instance.look.nameOr('Mangalam'),
        'description': planName,
        'order_id': orderId,
        'prefill': {
          if (user?.email != null && user!.email!.isNotEmpty)
            'email': user.email,
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

      // Loader while the backend verifies & credits the plan —
      // otherwise the user sees nothing happening for a few seconds.
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        useRootNavigator: true,
        builder: (ctx) => const PopScope(
          canPop: false,
          child: Center(
            child: CircularProgressIndicator(color: MangalamTheme.maroon),
          ),
        ),
      );
      try {
        await _api.post('/v1/payments/razorpay/verify', {
          'razorpay_order_id': res.orderId,
          'razorpay_payment_id': res.paymentId,
          'razorpay_signature': res.signature,
        });
      } finally {
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
        }
      }

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t('Payment successful — your plan is now active')),
          ),
        );
      }
      return true;
    } on TimeoutException catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(t('Payment timed out'))));
      }
      return false;
    } on _PaymentCancelException catch (e) {
      // P2: user dismissed the Razorpay checkout — no scary error toast.
      // Only surface a message for genuine (non-cancel) failures.
      if (!e.isCancelled && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t(e.friendlyMessage))),
        );
      }
      return false;
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t(_friendlyPaymentError(e)))),
        );
      }
      return false;
    } finally {
      _razorpay.clear();
    }
  }

  Future<bool> _startSubscription(
    BuildContext context,
    String planCode,
    String planName,
  ) async {
    final completer = Completer<PaymentSuccessResponse>();
    void onSuccess(PaymentSuccessResponse r) {
      if (!completer.isCompleted) completer.complete(r);
    }

    void onError(PaymentFailureResponse r) {
      if (!completer.isCompleted) {
        completer.completeError(
          _PaymentCancelException(r.code?.toString() ?? '', (r.message ?? '').toString()),
        );
      }
    }

    _razorpay.clear();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, onError);

    try {
      if (context.mounted) {
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          useRootNavigator: true,
          builder: (ctx) => const PopScope(
            canPop: false,
            child: Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            ),
          ),
        );
      }
      Map<String, dynamic> started;
      try {
        started = await _api.post('/v1/payments/razorpay/subscribe', {
              'plan_code': planCode,
            }) as Map<String, dynamic>;
      } finally {
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
        }
      }
      final keyId = started['key_id'] as String?;
      final subscriptionId = started['subscription_id'] as String?;
      if (keyId == null || subscriptionId == null) {
        throw Exception('Invalid membership response');
      }
      final user = Supabase.instance.client.auth.currentUser;
      _razorpay.open({
        'key': keyId,
        'subscription_id': subscriptionId,
        'name': AppBranding.instance.look.nameOr('Mangalam'),
        'description': planName,
        'prefill': {
          if (user?.email != null && user!.email!.isNotEmpty) 'email': user.email,
          if (user?.phone != null && user!.phone!.isNotEmpty) 'contact': user.phone,
        },
        'theme': {'color': '#B71C1C'},
      });
      final res = await completer.future.timeout(
        const Duration(minutes: 15),
        onTimeout: () => throw TimeoutException('Payment was not completed'),
      );
      if (!context.mounted) return false;
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        useRootNavigator: true,
        builder: (ctx) => const PopScope(
          canPop: false,
          child: Center(
            child: CircularProgressIndicator(color: MangalamTheme.maroon),
          ),
        ),
      );
      final paymentId = res.paymentId;
      final signature = res.signature;
      try {
        if (paymentId == null || paymentId.isEmpty || signature == null || signature.isEmpty) {
          throw Exception('Payment was not confirmed');
        }
        await _api.post('/v1/payments/razorpay/verify-subscription', {
          'razorpay_subscription_id': subscriptionId,
          'razorpay_payment_id': paymentId,
          'razorpay_signature': signature,
        });
      } finally {
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
        }
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Membership is active. It renews automatically.'))),
        );
      }
      return true;
    } on TimeoutException catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Payment timed out'))),
        );
      }
      return false;
    } on _PaymentCancelException catch (e) {
      if (!e.isCancelled && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t(e.friendlyMessage))),
        );
      }
      return false;
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t(_friendlyPaymentError(e)))),
        );
      }
      return false;
    } finally {
      _razorpay.clear();
    }
  }
}

/// Typed Razorpay failure so we can distinguish a user-initiated cancel
/// from a real payment error and avoid showing "Exception: Undefined".
class _PaymentCancelException implements Exception {
  const _PaymentCancelException(this.code, this.rawMessage);

  final String code;
  final String rawMessage;

  bool get isCancelled {
    final c = code.trim().toUpperCase();
    final m = rawMessage.trim().toLowerCase();
    // razorpay_flutter uses int codes: 2 = PAYMENT_CANCELLED.
    // Dismiss often arrives as code=2 with message "Undefined"/empty.
    if (c == '2' || c == 'PAYMENT_CANCELLED' || m.contains('cancel')) {
      return true;
    }
    // Treat bare "Undefined"/empty with no real error code as a dismiss.
    final looksUndefined = m.isEmpty || m == 'undefined';
    final noRealCode = c.isEmpty || c == 'null' || c == 'undefined';
    return looksUndefined && noRealCode;
  }

  String get friendlyMessage {
    if (isCancelled) return 'Payment cancelled.';
    switch (code.trim().toUpperCase()) {
      case '0':
      case 'NETWORK_ERROR':
        return 'Network error during payment. Check your connection.';
      case '1':
      case 'INVALID_OPTIONS':
      case 'BAD_REQUEST_ERROR':
        return 'Payment failed: invalid request. Please try again.';
      case 'PAYMENT_ERROR':
        return 'Payment could not be completed. Please try again.';
      case 'INVALID_VPA':
        return 'Invalid UPI ID. Please check and retry.';
      default:
        final m = rawMessage.trim();
        if (m.isNotEmpty && m.toLowerCase() != 'undefined') return m;
        return 'Payment failed. Please try again.';
    }
  }
}

String _friendlyPaymentError(Object e) {
  final s = e.toString().replaceFirst('Exception: ', '').trim();
  if (s.isEmpty || s.toLowerCase() == 'undefined') {
    return 'Payment failed. Please try again.';
  }
  return s;
}

class _PlanPickerSheet extends StatelessWidget {
  const _PlanPickerSheet({
    required this.plans,
    required this.title,
    required this.subtitle,
  });

  final List<Map<String, dynamic>> plans;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                t(title),
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                t(subtitle),
                style: const TextStyle(color: MangalamTheme.muted, fontSize: 13, height: 1.35),
              ),
              const SizedBox(height: 16),
            Flexible(
              fit: FlexFit.loose,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (plans.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Text(
                          t('No plans are available right now. Please check back later or contact support.'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: MangalamTheme.muted),
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
                        final period = p['billing_period']?.toString() ?? 'monthly';
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
                                    child: const Icon(
                                      Iconsax.crown,
                                      color: MangalamTheme.gold,
                                      size: 22,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          tCatalog(name),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                        if (desc != null && desc.isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(
                                              tCatalog(desc),
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: MangalamTheme.muted,
                                              ),
                                            ),
                                          ),
                                        const SizedBox(height: 4),
                                        Wrap(
                                          spacing: 6,
                                          children: [
                                            if (type == 'subscription')
                                              _chip(
                                                t(
                                                  period == 'yearly'
                                                      ? 'Renews yearly'
                                                      : period == 'quarterly'
                                                      ? 'Renews every 3 months'
                                                      : 'Renews monthly',
                                                ),
                                              )
                                            else
                                              _chip(t(type == 'credits' ? 'One-time add-on' : 'One-time')),
                                            if (credits > 0)
                                              _chip(
                                                tf(
                                                  type == 'subscription'
                                                      ? '{n} credits each renewal'
                                                      : '{n} credits',
                                                  {'n': '$credits'},
                                                ),
                                              ),
                                            if (days > 0 && type != 'subscription')
                                              _chip(tf('{n} days premium', {'n': '$days'})),
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
            ),
          ],
        ),
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
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: MangalamTheme.maroon,
        ),
      ),
    );
  }
}
