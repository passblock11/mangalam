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

/// Calls Mangalam `/v1` API with the current Supabase JWT.
class ApiClient {
  ApiClient();

  String? get currentUserId =>
      Supabase.instance.client.auth.currentUser?.id;

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    return Uri.parse('$base$path').replace(queryParameters: query);
  }

  Future<Map<String, String>> _headers() async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null || token.isEmpty) {
      throw ApiException(401, 'Not signed in');
    }
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) async {
    final res = await http.get(_uri(path, query), headers: await _headers());
    return _decode(res);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      _uri(path),
      headers: await _headers(),
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
    throw ApiException(res.statusCode, text);
  }
}
