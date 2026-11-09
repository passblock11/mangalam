import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';

/// Phone + MSG91 OTP (optional; requires DLT on server).
class PhoneOtpSheet extends StatefulWidget {
  const PhoneOtpSheet({super.key});

  @override
  State<PhoneOtpSheet> createState() => _PhoneOtpSheetState();
}

class _PhoneOtpSheetState extends State<PhoneOtpSheet> {
  final _api = ApiClient();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;
  bool _busy = false;
  String? _error;
  int _retryAfterSec = 0;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  String _normalizePhoneInput() {
    return _phoneController.text.trim().replaceAll(RegExp(r'\s'), '');
  }

  Future<void> _sendOtp({bool resend = false}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final json = await _api.postPublic('/v1/auth/otp/send', {
        'phone': _normalizePhoneInput(),
        if (resend) 'resend': true,
      }) as Map<String, dynamic>;

      final smsSent = json['sms_sent'] == true;
      setState(() {
        _otpSent = true;
        _retryAfterSec = (json['retry_after_sec'] as num?)?.toInt() ?? 0;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              smsSent
                  ? 'OTP sent via SMS.'
                  : (json['message'] as String? ??
                      'OTP already sent. Check your messages.'),
            ),
          ),
        );
      }
    } catch (e) {
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final json = await _api.postPublic('/v1/auth/otp/verify', {
        'phone': _normalizePhoneInput(),
        'otp': _otpController.text.trim(),
      }) as Map<String, dynamic>;

      final session = json['session'] as Map<String, dynamic>?;
      if (session == null) throw Exception('No session in response');

      await Supabase.instance.client.auth.setSession(
        session['refresh_token'] as String,
        accessToken: session['access_token'] as String?,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _friendlyError(Object e) {
    final raw = e.toString();
    if (raw.contains('DLT') || raw.contains('MSG91') || raw.contains('211')) {
      return 'SMS blocked by DLT. Use Google or Apple on the main screen.';
    }
    return raw.replaceFirst('ApiException(', '').replaceAll('): ', ': ');
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 8, 24, 24 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Phone OTP',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Requires MSG91 DLT for Indian numbers.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            enabled: !_otpSent,
            decoration: const InputDecoration(
              labelText: 'Phone number',
              hintText: '9876543210',
              border: OutlineInputBorder(),
            ),
          ),
          if (_otpSent) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'OTP',
                border: OutlineInputBorder(),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed:
                    _busy || _retryAfterSec > 0 ? null : () => _sendOtp(resend: true),
                child: Text(
                  _retryAfterSec > 0
                      ? 'Resend (${_retryAfterSec}s)'
                      : 'Resend SMS',
                ),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy
                ? null
                : (_otpSent ? _verifyOtp : () => _sendOtp()),
            child: _busy
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(_otpSent ? 'Verify' : 'Send OTP'),
          ),
        ],
      ),
    );
  }
}
