import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  /// Clean, human-readable message extracted from the backend response.
  final String message;
  @override
  String toString() => message;
}

/// Thrown when the backend rejects the token because the user is banned.
/// Carries the admin-supplied ban reason so the app can show it.
class BannedException implements Exception {
  BannedException({this.reason});
  final String? reason;
  @override
  String toString() => 'BannedException: ${reason ?? "account banned"}';
}

/// Calls Mangalam `/v1` API with the current Supabase JWT.
class ApiClient {
  ApiClient();

  String? get currentUserId => Supabase.instance.client.auth.currentUser?.id;

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    return Uri.parse('$base$path').replace(queryParameters: query);
  }

  static const _jsonHeaders = {'Content-Type': 'application/json'};

  Future<Map<String, String>> _authHeaders() async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null || token.isEmpty) {
      throw ApiException(401, 'Not signed in');
    }
    return {..._jsonHeaders, 'Authorization': 'Bearer $token'};
  }

  /// Unauthenticated POST (e.g. login OTP send/verify).
  Future<dynamic> postPublic(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) async {
    final res = await http.get(
      _uri(path, query),
      headers: await _authHeaders(),
    );
    return _decode(res);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: await _authHeaders(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      _uri(path),
      headers: await _authHeaders(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    final text = res.body;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (text.isEmpty) return null;
      return jsonDecode(text);
    }
    // Detect ban: backend returns 403 with { banned: true, ban_reason }
    if (res.statusCode == 403) {
      try {
        final body = jsonDecode(text) as Map<String, dynamic>;
        if (body['banned'] == true) {
          throw BannedException(reason: body['ban_reason']?.toString());
        }
      } catch (e) {
        if (e is BannedException) rethrow;
      }
    }
    // Extract a clean, user-readable message from the backend error body,
    // falling back to a friendly default per HTTP status code.
    throw ApiException(res.statusCode, _extractMessage(res.statusCode, text));
  }

  /// Pull a human-readable message out of a backend error JSON. Handles:
  ///   { "error": "some message" }                      → "some message"
  ///   { "error": { formErrors: [], fieldErrors: {...} } }  (Zod)  → joined
  ///   anything else                                   → friendly default
  String _extractMessage(int status, String text) {
    try {
      final decoded = jsonDecode(text);
      if (decoded is Map<String, dynamic>) {
        final err = decoded['error'];
        if (err is String && err.trim().isNotEmpty) return err.trim();
        if (err is Map) {
          final parts = <String>[];
          final fe = err['fieldErrors'];
          if (fe is Map) {
            fe.forEach((k, v) {
              if (v is List && v.isNotEmpty) {
                parts.add('$k: ${v.first}');
              } else if (v is String) {
                parts.add('$k: $v');
              }
            });
          }
          final formErrs = err['formErrors'];
          if (formErrs is List) {
            for (final f in formErrs) {
              if (f is String && f.trim().isNotEmpty) parts.add(f.trim());
            }
          }
          if (parts.isNotEmpty) return parts.join('; ');
        }
      }
    } catch (_) {
      // not JSON — fall through to default
    }
    return _defaultMessage(status);
  }

  String _defaultMessage(int status) {
    switch (status) {
      case 400:
        return 'Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 402:
        return 'Payment is required to continue.';
      case 403:
        return 'You do not have permission to do that.';
      case 404:
        return 'The information you requested was not found.';
      case 409:
        return 'That conflicts with existing data. Please refresh and try again.';
      case 422:
        return 'Some of the information provided is invalid.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      default:
        if (status >= 500) {
          return 'Something went wrong on our end. Please try again.';
        }
        return 'Request failed. Please try again.';
    }
  }
}
