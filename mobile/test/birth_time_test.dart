import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mangalam_app/ui/core/birth_time_field.dart';
import 'package:mangalam_app/ui/profile/profile_widgets.dart';

void main() {
  test('birth time parses clock text and still formats for the profile', () {
    expect(parseBirthTime('6:55 pm')?.hour, 18);
    expect(parseBirthTime('6:55 pm')?.minute, 55);
    expect(parseBirthTime('6:55 am')?.hour, 6);
    expect(parseBirthTime('12:05 AM')?.hour, 0);
    expect(parseBirthTime('18:55')?.hour, 18);
    expect(parseBirthTime('hello'), isNull);
    expect(formatBirthTime('18:55'), '6:55 PM');
  });
}
