/// Compile-time configuration.
///
/// Defaults match this repo’s Supabase project so `flutter run` works from the IDE
/// without extra flags. Override per environment with `--dart-define` or
/// `--dart-define-from-file=dart_defines.json` (see `dart_defines.example.json`).
class AppConfig {
  AppConfig._();

  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://behlrsqilhzhniglhgqh.supabase.co',
  );
  /// Supabase publishable (anon) key — safe in client apps; not the service role key.
  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'sb_publishable_G8YGou0J7alwZirbjuCQdQ_YCiyk0LD',
  );

  /// REST API (Vercel backend), e.g. https://mangalam-api.vercel.app (no trailing slash).
  /// Override with `--dart-define=API_BASE_URL=...` for local API.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://mangalam-api.vercel.app',
  );

  static bool get hasSupabase =>
      supabaseUrl.isNotEmpty && supabasePublishableKey.isNotEmpty;
}
