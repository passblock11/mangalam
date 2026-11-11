import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.body);
  final int statusCode;
  final String body;
  @override
  String toString() => 'ApiException($statusCode): $body';
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
    throw ApiException(res.statusCode, text);
  }
}
