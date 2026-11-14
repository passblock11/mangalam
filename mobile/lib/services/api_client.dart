import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';
import '../l10n/app_locale.dart';
import 'ban_session.dart';
import 'payload_crypto.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  /// Clean, human-readable message extracted from the backend response.
  final String message;
  @override
  String toString() => message;
}

/// Turns a known database error into a sentence the member can act on.
String userFacingError(Object error) {
  var raw = error.toString().trim();
  if (raw.contains('profiles_phone_key') || raw.contains('profile_phone_key')) {
    return 'This phone number is already registered with another account.';
  }
  if (raw.contains('PathNotFound') || raw.contains('No such file')) {
    return 'One of the photos could not be attached.';
  }
  for (final prefix in ['Exception: ', 'StateError: ', 'Bad state: ']) {
    if (raw.startsWith(prefix)) raw = raw.substring(prefix.length).trim();
  }
  return raw;
}

/// The same sentence, in the language the member selected.
String tError(Object error) => t(userFacingError(error));

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
    await _refreshIfExpiring();
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null || token.isEmpty) {
      throw ApiException(401, 'Not signed in');
    }
    return {..._jsonHeaders, 'Authorization': 'Bearer $token'};
  }

  /// Refresh the Supabase session when the access token is missing or
  /// within 90 seconds of expiry, so API calls don't fail with
  /// "Invalid or expired token" while a refresh token is still valid.
  Future<void> _refreshIfExpiring() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return;
    final exp = session.expiresAt;
    if (exp == null) return;
    final expires = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
    if (expires.difference(DateTime.now()) > const Duration(seconds: 90)) {
      return;
    }
    await _refreshOnce();
  }

  static Future<bool>? _refreshInFlight;

  Future<bool> _refreshOnce() {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final fut = Supabase.instance.client.auth
        .refreshSession()
        .then((res) => res.session != null)
        .catchError((_) => false);
    _refreshInFlight = fut;
    return fut.whenComplete(() {
      if (identical(_refreshInFlight, fut)) _refreshInFlight = null;
    });
  }

  Future<http.Response> _send(
    Future<http.Response> Function() request,
  ) async {
    var res = await request();
    if (res.statusCode == 401) {
      final ok = await _refreshOnce();
      if (ok) res = await request();
    }
    return res;
  }

  /// Public GET. Splash and login call this before a member is signed in.
  Future<dynamic> getPublic(String path) async {
    final prepared = await _prepare(auth: false);
    final res = await http.get(_uri(path), headers: prepared.headers);
    return _decode(res);
  }

  /// Unauthenticated POST (e.g. login OTP send/verify).
  Future<dynamic> postPublic(String path, Map<String, dynamic> body) async {
    final prepared = await _prepare(auth: false, jsonBody: body);
    final res = await http.post(
      _uri(path),
      headers: prepared.headers,
      body: prepared.body,
    );
    return _decode(res);
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) async {
    // P9: short-lived in-memory cache for stable public config endpoints
    // to cut redundant network calls when navigating between tabs. These
    // responses change rarely (admin-managed), so a 60s TTL is safe and
    // never affects user-specific data.
    if (query == null && _cacheablePaths.contains(path)) {
      final hit = _Cache.read(path);
      if (hit != null) return hit;
    }
    final res = await _send(() async {
      final prepared = await _prepare(auth: true, query: query);
      return http.get(
        _uri(path, prepared.query),
        headers: prepared.headers,
      );
    });
    final decoded = await _decode(res);
    if (query == null && _cacheablePaths.contains(path)) {
      _Cache.write(path, decoded);
    }
    return decoded;
  }

  /// Paths safe to cache briefly (public, admin-managed, rarely change).
  static const _cacheablePaths = <String>{
    '/v1/config',
    '/v1/config/plans',
  };


  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await _send(() async {
      final prepared = await _prepare(auth: true, jsonBody: body);
      return http.post(
        _uri(path),
        headers: prepared.headers,
        body: prepared.body,
      );
    });
    return _decode(res);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final res = await _send(() async {
      final prepared = await _prepare(auth: true, jsonBody: body);
      return http.patch(
        _uri(path),
        headers: prepared.headers,
        body: prepared.body,
      );
    });
    return _decode(res);
  }

  Future<dynamic> delete(String path) async {
    final res = await _send(() async {
      final prepared = await _prepare(auth: true);
      return http.delete(_uri(path), headers: prepared.headers);
    });
    return _decode(res);
  }

  Future<_Prepared> _prepare({
    required bool auth,
    Map<String, String>? query,
    Map<String, dynamic>? jsonBody,
  }) async {
    final headers = auth
        ? await _authHeaders()
        : Map<String, String>.from(_jsonHeaders);
    var sendQuery = query;
    List<int>? body;
    if (PayloadCrypto.enabled) {
      headers['X-Mangalam-Enc'] = '1';
      if (query != null && query.isNotEmpty) {
        final sealed = await PayloadCrypto.sealHeader(jsonEncode(query));
        if (sealed.length <= 7000) {
          headers['X-Mangalam-Q'] = sealed;
          sendQuery = null;
        }
      }
      if (jsonBody != null) {
        body = await PayloadCrypto.sealBytes(jsonEncode(jsonBody));
        headers['Content-Type'] = 'application/octet-stream';
      }
    } else if (jsonBody != null) {
      body = utf8.encode(jsonEncode(jsonBody));
    }
    return _Prepared(headers: headers, query: sendQuery, body: body);
  }

  Future<dynamic> _decode(http.Response res) async {
    late final String text;
    try {
      text = await PayloadCrypto.openIfSealed(res.bodyBytes);
    } catch (_) {
      throw ApiException(
        res.statusCode == 0 ? 400 : res.statusCode,
        'Could not read the server response.',
      );
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (text.isEmpty) return null;
      return jsonDecode(text);
    }
    // Detect ban: backend returns 403 with { banned: true, ban_reason }
    if (res.statusCode == 403) {
      try {
        final body = jsonDecode(text) as Map<String, dynamic>;
        if (body['banned'] == true) {
          await closeBannedSession();
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

/// Tiny per-process GET cache with a TTL. Used only for the small set of
/// stable, public config endpoints listed in [_cacheablePaths]. Keeping
/// this static means every ApiClient instance shares one cache, so
/// navigating between tabs doesn't refetch the same plans/config.
class _Cache {
  _Cache._();

  static const _ttl = Duration(seconds: 60);
  static final _store = <String, _CacheEntry>{};

  static dynamic read(String path) {
    final e = _store[path];
    if (e == null) return null;
    if (DateTime.now().difference(e.at) > _ttl) {
      _store.remove(path);
      return null;
    }
    return e.value;
  }

  static void write(String path, dynamic value) {
    _store[path] = _CacheEntry(value, DateTime.now());
  }
}

class _CacheEntry {
  const _CacheEntry(this.value, this.at);
  final dynamic value;
  final DateTime at;
}

class _Prepared {
  const _Prepared({required this.headers, required this.query, this.body});
  final Map<String, String> headers;
  final Map<String, String>? query;
  final List<int>? body;
}
