import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mangalam_app/services/app_branding.dart';

void main() {
  test('missing branding keeps the built-in design', () {
    expect(BrandLook.parse(null).custom, isFalse);
    expect(BrandLook.parse({'active': 'default'}).custom, isFalse);
    expect(BrandLook.builtin.durationMs, 3000);
    expect(BrandLook.builtin.showMandala, isTrue);
  });

  test('custom branding drops unsafe values and keeps https images', () {
    final look = BrandLook.parse({
      'active': 'custom',
      'app_name': '  Swaad  ',
      'logo_url': 'http://evil.test/a.png',
      'splash': {
        'duration_ms': 10,
        'animation': 'nope',
        'background_start': 'red',
      },
      'login': {
        'background_images': [
          'https://cdn.example.com/a.jpg',
          'javascript:alert(1)',
          'https://cdn.example.com/a.jpg',
          'https://cdn.example.com/b.jpg',
        ],
      },
    });
    expect(look.custom, isTrue);
    expect(look.appName, 'Swaad');
    expect(look.logoUrl, isEmpty);
    expect(look.durationMs, 1500);
    expect(look.animation, 'scale_fade');
    expect(look.splashStart, const Color(0xFFB71C1C));
    expect(look.loginImages, [
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
    expect(look.nameOr('Mangalam'), 'Swaad');
  });

  test('name and logo apply while the built-in design stays', () {
    final look = BrandLook.parse({
      'active': 'default',
      'app_name': 'Mangalam',
      'logo_url': 'https://cdn.example.com/logo.png',
    });
    expect(look.custom, isFalse);
    expect(look.appName, 'Mangalam');
    expect(look.logoUrl, 'https://cdn.example.com/logo.png');
    expect(look.showMandala, isTrue);
    expect(look.nameOr('Mangalam'), 'Mangalam');
  });
}
