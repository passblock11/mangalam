import 'package:flutter_test/flutter_test.dart';
import 'package:mangalam_app/ui/auth/indian_communities.dart';

void main() {
  test('community list is a unique selectable set', () {
    expect(indianCommunities.length, greaterThanOrEqualTo(500));
    final seen = <String>{};
    for (final name in indianCommunities) {
      expect(name.trim(), name);
      expect(name, isNotEmpty);
      expect(seen.add(name.toLowerCase()), isTrue, reason: name);
    }
  });
}
