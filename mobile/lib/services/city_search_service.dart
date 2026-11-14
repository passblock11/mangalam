import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// A city search result from OpenStreetMap Nominatim.
class CityResult {
  CityResult({
    required this.displayName,
    required this.city,
    required this.state,
    this.lat,
    this.lon,
  });

  final String displayName;
  final String city;
  final String state;
  final String? lat;
  final String? lon;

  @override
  String toString() => displayName;
}

/// Free city autocomplete using OpenStreetMap Nominatim.
///
/// No API key required. Usage policy: max 1 request/second with a valid
/// User-Agent. We debounce calls by 600ms to respect this and avoid
/// rate-limiting.
///
/// Endpoint: https://nominatim.openstreetmap.org/search
class CitySearchService {
  CitySearchService._();

  static const _endpoint = 'https://nominatim.openstreetmap.org/search';
  static const _countrycodes = 'in'; // India
  static const _limit = 6;

  static final _timers = <Object, Timer>{};
  static final _tokens = <Object, int>{};
  static const _shared = Object();

  /// Search Indian cities matching [query]. Returns at most 6 results.
  /// Debounced by 600ms to respect Nominatim's 1 req/sec policy.
  ///
  /// [owner] keeps two fields on the same screen from cancelling each other.
  static void search(
    String query, {
    Object? owner,
    required void Function(List<CityResult>) onResults,
    required void Function(bool loading) onLoading,
  }) {
    final key = owner ?? _shared;
    final token = (_tokens[key] ?? 0) + 1;
    _tokens[key] = token;
    _timers.remove(key)?.cancel();
    final q = query.trim();
    if (q.length < 2) {
      onLoading(false);
      onResults(const []);
      return;
    }
    onLoading(true);
    _timers[key] = Timer(const Duration(milliseconds: 600), () async {
      try {
        final uri = Uri.parse(_endpoint).replace(
          queryParameters: {
            'format': 'json',
            'q': q,
            'countrycodes': _countrycodes,
            'addressdetails': '1',
            'limit': '$_limit',
          },
        );
        final res = await http
            .get(
              uri,
              headers: {
                'User-Agent':
                    'MangalamApp/1.0 (matrimonial app; contact@mangalam.app)',
                'Accept': 'application/json',
              },
            )
            .timeout(const Duration(seconds: 5));

        if (_tokens[key] != token) return;
        if (res.statusCode != 200) {
          onLoading(false);
          onResults(const []);
          return;
        }
        final list = jsonDecode(res.body) as List<dynamic>;
        final results = <CityResult>[];
        for (final item in list) {
          final m = item as Map<String, dynamic>;
          final addr = (m['address'] as Map<String, dynamic>?) ?? {};
          // Pick the most specific city-like field
          final city =
              (addr['city'] ??
                      addr['town'] ??
                      addr['village'] ??
                      addr['municipality'] ??
                      addr['county'] ??
                      addr['subdistrict'] ??
                      addr['state_district'])
                  ?.toString();
          final state = (addr['state'] ?? addr['region'])?.toString();
          if (_tokens[key] != token) return;
          if (city == null) continue;
          results.add(
            CityResult(
              displayName: m['display_name']?.toString() ?? city,
              city: city,
              state: state ?? '',
              lat: m['lat']?.toString(),
              lon: m['lon']?.toString(),
            ),
          );
        }
        if (_tokens[key] != token) return;
        onLoading(false);
        onResults(results);
      } catch (_) {
        if (_tokens[key] != token) return;
        onLoading(false);
        onResults(const []);
      }
    });
  }

  /// Cancel a pending search. With no [owner], every search is cancelled.
  static void cancel([Object? owner]) {
    if (owner == null) {
      for (final timer in _timers.values) {
        timer.cancel();
      }
      _timers.clear();
      _tokens.clear();
      return;
    }
    _tokens[owner] = (_tokens[owner] ?? 0) + 1;
    _timers.remove(owner)?.cancel();
  }
}
