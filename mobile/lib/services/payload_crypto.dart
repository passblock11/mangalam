import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import '../core/config.dart';

/// AES-256-GCM envelopes shared with the API.
///
/// Sealed bytes are ASCII "mg1", a 12-byte IV, then ciphertext whose last
/// 16 bytes are the tag. Plain JSON still decodes, so a response that is
/// not sealed keeps working.
class PayloadCrypto {
  PayloadCrypto._();

  static const _magic = [0x6d, 0x67, 0x31];
  static final _aes = AesGcm.with256bits();

  static bool get enabled {
    try {
      return _keyBytes(AppConfig.payloadKey) != null;
    } catch (_) {
      return false;
    }
  }

  static bool isSealed(List<int> bytes) {
    return bytes.length >= _magic.length + 12 + 16 &&
        bytes[0] == _magic[0] &&
        bytes[1] == _magic[1] &&
        bytes[2] == _magic[2];
  }

  static Future<Uint8List> sealBytes(
    String plain, {
    List<int>? key,
    List<int>? nonce,
  }) async {
    final keyBytes = key ?? _keyBytes(AppConfig.payloadKey);
    if (keyBytes == null) {
      throw StateError('Secure channel is not configured');
    }
    final iv = Uint8List.fromList(nonce ?? _randomIv());
    final box = await _aes.encrypt(
      utf8.encode(plain),
      secretKey: SecretKey(keyBytes),
      nonce: iv,
    );
    final mac = box.mac.bytes;
    final ct = box.cipherText;
    final out = Uint8List(_magic.length + iv.length + ct.length + mac.length);
    out.setAll(0, _magic);
    out.setAll(_magic.length, iv);
    out.setAll(_magic.length + iv.length, ct);
    out.setAll(_magic.length + iv.length + ct.length, mac);
    return out;
  }

  static Future<String> openBytes(List<int> bytes, {List<int>? key}) async {
    if (!isSealed(bytes)) {
      throw const FormatException('payload envelope');
    }
    final keyBytes = key ?? _keyBytes(AppConfig.payloadKey);
    if (keyBytes == null) {
      throw StateError('Secure channel is not configured');
    }
    final data = Uint8List.fromList(bytes);
    final iv = data.sublist(_magic.length, _magic.length + 12);
    final rest = data.sublist(_magic.length + 12);
    if (rest.length < 16) throw const FormatException('payload envelope');
    final ct = rest.sublist(0, rest.length - 16);
    final mac = rest.sublist(rest.length - 16);
    final clear = await _aes.decrypt(
      SecretBox(ct, nonce: iv, mac: Mac(mac)),
      secretKey: SecretKey(keyBytes),
    );
    return utf8.decode(clear);
  }

  static Future<String> sealHeader(String plain) async {
    return base64Url.encode(await sealBytes(plain)).replaceAll('=', '');
  }

  /// Returns [bytes] as text when they are ordinary JSON.
  static Future<String> openIfSealed(List<int> bytes) async {
    if (!isSealed(bytes)) return utf8.decode(bytes);
    return openBytes(bytes);
  }

  static Map<String, String> requestHeaders([Map<String, String>? base]) {
    final headers = <String, String>{...?base};
    if (enabled) headers['X-Mangalam-Enc'] = '1';
    return headers;
  }

  static List<int>? _keyBytes(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    try {
      final bytes = base64.decode(trimmed);
      if (bytes.length != 32) return null;
      return bytes;
    } catch (_) {
      return null;
    }
  }

  static List<int> _randomIv() {
    final random = Random.secure();
    return List<int>.generate(12, (_) => random.nextInt(256));
  }
}
