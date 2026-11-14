import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mangalam_app/services/payload_crypto.dart';

void main() {
  test('matches the server envelope and still reads plain JSON', () async {
    final json =
        jsonDecode(File('test/payload_vector.json').readAsStringSync())
            as Map<String, dynamic>;
    final key = base64.decode(json['key_b64'] as String);
    final sealed = base64.decode(json['sealed_b64'] as String);
    final opened = await PayloadCrypto.openBytes(sealed, key: key);
    expect(opened, json['plain']);

    final again = await PayloadCrypto.sealBytes(
      opened,
      key: key,
      nonce: List<int>.filled(12, 0x22),
    );
    expect(base64.encode(again), json['sealed_b64']);

    final plain = utf8.encode('{"ok":true}');
    expect(await PayloadCrypto.openIfSealed(plain), '{"ok":true}');
  });
}
