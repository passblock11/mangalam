import 'api_client.dart';

/// Short, member-safe copy — never show long JSON or gateway dumps in a snackbar.
String friendlyPaymentMessage(Object error) {
  if (error is ApiException) {
    final message = error.message.trim();
    final lower = message.toLowerCase();
    if (lower.contains('do not pay again') || lower.contains('still confirming your payment')) {
      return message;
    }
    if (lower.contains('not confirmed') ||
        lower.contains('not active yet') ||
        lower.contains('setup is not confirmed')) {
      return 'We are still confirming your payment. Please wait, then tap Continue.';
    }
    if (lower.contains('could not reach phonepe') || lower.contains('phonepe auth failed')) {
      return 'Payment could not be confirmed right now. Please try again in a moment.';
    }
    if (message.length > 140) {
      return 'Payment could not be confirmed. If money was debited, wait a minute and tap Continue.';
    }
    return message;
  }
  final raw = userFacingError(error);
  if (raw.length > 140) {
    return 'Payment could not be confirmed. Please try again.';
  }
  return raw;
}