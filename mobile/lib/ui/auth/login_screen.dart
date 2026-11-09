import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
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
      final json = await _api.post('/v1/auth/otp/send', {
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
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final json = await _api.post('/v1/auth/otp/verify', {
        'phone': _normalizePhoneInput(),
        'otp': _otpController.text.trim(),
      }) as Map<String, dynamic>;

      final session = json['session'] as Map<String, dynamic>?;
      if (session == null) {
        throw Exception('No session in response');
      }
      final refreshToken = session['refresh_token'] as String;
      await Supabase.instance.client.auth.setSession(refreshToken);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Text(
                'Mangalam',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in with your phone number',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                enabled: !_otpSent,
                decoration: const InputDecoration(
                  labelText: 'Phone number',
                  hintText: '9876543210 or +919876543210',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              if (_otpSent) ...[
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'OTP',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed:
                        _busy || _retryAfterSec > 0 ? null : () => _sendOtp(resend: true),
                    child: Text(
                      _retryAfterSec > 0
                          ? 'Resend SMS (${_retryAfterSec}s)'
                          : 'Resend SMS',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              if (_error != null)
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              const Spacer(),
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
                    : Text(_otpSent ? 'Verify & continue' : 'Send OTP'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
