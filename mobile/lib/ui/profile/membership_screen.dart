import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../../services/razorpay_checkout.dart';
import '../../utils/formatting.dart';
import '../core/mangalam_theme.dart';

/// Membership home: current plan, what it includes, and the member's payments.
class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  final _api = ApiClient();
  final _razorpay = RazorpayCheckout();
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _razorpay.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get('/v1/payments/membership') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = json;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  Map<String, dynamic>? get _subscription {
    final raw = _data?['subscription'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  List<Map<String, dynamic>> get _payments {
    final raw = _data?['payments'];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  bool get _active {
    final until = DateTime.tryParse(_data?['premium_until']?.toString() ?? '');
    return until != null && until.isAfter(DateTime.now());
  }

  bool get _waived => _data?['membership_waived'] == true;

  /// Paid plan, or a woman while the admin has included membership for women.
  bool get _benefits => _waived || _active || _data?['benefits_active'] == true;

  bool get _addonsAllowed => _data?['addons_allowed'] == true;

  bool get _canCancel {
    final sub = _subscription;
    if (sub == null || sub['cancel_at_period_end'] == true) return false;
    final status = sub['status']?.toString() ?? '';
    return status == 'active' || status == 'authenticated' || status == 'pending';
  }

  String get _planName {
    final name = _subscription?['plan_name']?.toString().trim() ?? '';
    if (name.isNotEmpty) return tCatalog(name);
    if (_waived && !_active) return t('Included');
    return _active ? t('Premium') : t('No active membership');
  }

  String get _period {
    return periodLabel(
      billing: _subscription?['billing_period']?.toString(),
      days: (_subscription?['duration_days'] as num?)?.toInt(),
    );
  }

  String? get _untilLabel {
    final until = _data?['premium_until']?.toString();
    final formatted = until == null || until.isEmpty ? '' : formatDate(until);
    if (formatted.isEmpty) return null;
    final cancelling = _subscription?['cancel_at_period_end'] == true;
    if (cancelling) return '${t('Ends on')} $formatted';
    final status = _subscription?['status']?.toString() ?? '';
    if (status == 'active' || status == 'authenticated') {
      return '${t('Renews on')} $formatted';
    }
    return '${t('Membership expiring on')} $formatted';
  }

  Future<void> _buyMembership() async {
    final ok = await _razorpay.buyMembership(context);
    if (ok && mounted) await _load();
  }

  Future<void> _buyCredits() async {
    final ok = await _razorpay.rechargeContactCredits(context);
    if (ok && mounted) await _load();
  }

  Future<void> _cancel() async {
    final until = formatDate(_data?['premium_until']);
    final when = until.isEmpty ? t('the paid date') : until;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('Cancel membership')),
        content: Text('${t('Renewal stops after this period. You keep membership until')} $when.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t('Keep membership')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t('Cancel membership')),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await _api.post('/v1/payments/razorpay/subscription/cancel', {});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Membership will end after the current period.'))),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F4F0),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: Text(t('My Membership')),
        centerTitle: false,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: MangalamTheme.maroon))
          : _error != null
          ? MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load membership',
              subtitle: _error,
              action: FilledButton(onPressed: _load, child: Text(t('Retry'))),
            )
          : RefreshIndicator(
              color: MangalamTheme.maroon,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  _hero(),
                  const SizedBox(height: 22),
                  _heading('Package usage'),
                  const SizedBox(height: 10),
                  _usageCard(),
                  if (_payments.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    _heading('Payment status'),
                    const SizedBox(height: 10),
                    _latestPayment(_payments.first),
                    const SizedBox(height: 22),
                    _heading('All transactions'),
                    const SizedBox(height: 10),
                    ..._payments.map(_transaction),
                  ] else ...[
                    const SizedBox(height: 22),
                    _heading('All transactions'),
                    const SizedBox(height: 10),
                    _emptyPayments(),
                  ],
                  const SizedBox(height: 22),
                  if (!_benefits)
                    FilledButton.icon(
                      onPressed: _buyMembership,
                      icon: const Icon(Iconsax.crown),
                      label: Text(t('Choose a membership')),
                    ),
                  if (_addonsAllowed) ...[
                    if (!_benefits) const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _buyCredits,
                      icon: const Icon(Iconsax.flash),
                      label: Text(t('Buy contact credits')),
                    ),
                  ],
                  if (_canCancel) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _cancel,
                      child: Text(t('Cancel membership')),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _heading(String text) {
    return Text(
      t(text),
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: MangalamTheme.ink,
      ),
    );
  }

  Widget _hero() {
    final until = _untilLabel;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
            color: const Color(0xFFFFF6D8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_benefits)
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF18A058),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            t('Active'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      Text(
                        _planName,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: MangalamTheme.ink,
                        ),
                      ),
                      if (_period.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          _period,
                          style: const TextStyle(
                            fontSize: 15,
                            color: MangalamTheme.ink,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  width: 46,
                  height: 46,
                  decoration: const BoxDecoration(
                    color: MangalamTheme.gold,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Iconsax.crown, color: Colors.white, size: 24),
                ),
              ],
            ),
          ),
          if (until != null)
            Container(
              color: const Color(0xFFF3F6FB),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Iconsax.clock, size: 16, color: MangalamTheme.muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      until,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF3D4A63),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _usageCard() {
    final credits = (_data?['contact_credits'] as num?)?.toInt() ?? 0;
    final allowance = (_subscription?['plan_credits'] as num?)?.toInt() ?? 0;
    final contacts = allowance > credits && allowance > 0 ? '$credits/$allowance' : '$credits';
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7E2DC)),
      ),
      child: Column(
        children: [
          _usageRow(Iconsax.call, 'Contacts left', contacts),
          const Divider(height: 1, indent: 16, endIndent: 16),
          _usageRow(Iconsax.mobile, 'Phone numbers', _benefits ? 'Included' : 'Locked'),
          const Divider(height: 1, indent: 16, endIndent: 16),
          _usageRow(Iconsax.message, 'Messages', _messageValue()),
          const Divider(height: 1, indent: 16, endIndent: 16),
          _usageRow(
            Iconsax.crown,
            'Premium',
            _benefits ? 'Included' : 'Locked',
          ),
          if (_messageNote() != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Text(
                _messageNote()!,
                style: const TextStyle(fontSize: 12.5, color: MangalamTheme.muted, height: 1.35),
              ),
            ),
        ],
      ),
    );
  }

  String _messageValue() {
    if (_waived) return 'Included';
    final cost = (_data?['message_credit_cost'] as num?)?.toInt();
    if (cost == null) return 'Included';
    if (cost <= 0) return 'Included';
    return tf('{n} credits', {'n': '$cost'});
  }

  String? _messageNote() {
    if (_waived) return null;
    final cost = (_data?['message_credit_cost'] as num?)?.toInt();
    if (cost == null || cost <= 0) return null;
    final free = (_data?['message_free_per_chat'] as num?)?.toInt() ?? 0;
    if (free > 0) {
      return tf('Each message uses {n} credits after {free} free messages in a chat.', {
        'n': '$cost',
        'free': '$free',
      });
    }
    return tf('Each message uses {n} credits.', {'n': '$cost'});
  }

  Widget _usageRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: [
          Icon(icon, size: 20, color: MangalamTheme.ink),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              t(label),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
          Text(
            value == 'Included' || value == 'Locked' ? t(value) : value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _latestPayment(Map<String, dynamic> payment) {
    final paise = (payment['amount_paise'] as num?)?.toInt() ?? 0;
    final when = _shortDate(payment['created_at']);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7E2DC)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: Color(0xFF18A058),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('Amount debited successfully'),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text(
                  when.isEmpty
                      ? _rupees(paise)
                      : '${_rupees(paise)} ${t('debited on')} $when',
                  style: const TextStyle(color: MangalamTheme.muted, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _transaction(Map<String, dynamic> payment) {
    final name = (payment['plan_name']?.toString().trim().isNotEmpty ?? false)
        ? tCatalog(payment['plan_name'].toString())
        : ((payment['credits'] as num?)?.toInt() ?? 0) > 0
        ? t('Contact credits')
        : t('Premium');
    final period = periodLabel(
      billing: payment['billing_period']?.toString(),
      days: (payment['premium_days'] as num?)?.toInt(),
    );
    final credits = (payment['credits'] as num?)?.toInt() ?? 0;
    final subtitle = period.isNotEmpty
        ? period
        : credits > 0
        ? '$credits ${t('credits')}'
        : '';
    final paise = (payment['amount_paise'] as num?)?.toInt() ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7E2DC)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                if (subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle,
                      style: const TextStyle(color: MangalamTheme.muted, fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '−${_rupees(paise)}',
                style: const TextStyle(
                  color: MangalamTheme.maroon,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _longDate(payment['created_at']),
                style: const TextStyle(color: MangalamTheme.muted, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _emptyPayments() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7E2DC)),
      ),
      child: Text(
        t('No payments yet'),
        style: const TextStyle(color: MangalamTheme.muted),
      ),
    );
  }
}

String periodLabel({String? billing, int? days}) {
  if (billing == 'quarterly' || (days != null && days >= 80 && days <= 100)) {
    return t('3 months');
  }
  if (billing == 'yearly' || (days != null && days >= 360 && days <= 366)) {
    return t('1 year');
  }
  if (billing == 'monthly' || (days != null && days >= 28 && days <= 31)) {
    return t('1 month');
  }
  if (days != null && days > 0) return '$days ${t('days')}';
  return '';
}

String _rupees(int paise) {
  final rupees = paise / 100;
  final whole = rupees == rupees.roundToDouble();
  final formatted = NumberFormat.decimalPattern('en_IN').format(whole ? rupees.round() : rupees);
  return '₹$formatted';
}

String _shortDate(Object? value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return '';
  return DateFormat('dd/MM/yyyy').format(parsed.toLocal());
}

String _longDate(Object? value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return '';
  return DateFormat('MMM dd, yyyy').format(parsed.toLocal());
}
