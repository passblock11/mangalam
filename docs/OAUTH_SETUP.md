# Google & Apple sign-in (Mangalam mobile)

Login uses **Supabase Auth** native OAuth (no SMS / DLT).

## 1. Supabase Dashboard (behlrsqilhzhniglhgqh)

**Authentication → Providers**

| Provider | Action |
|----------|--------|
| **Google** | Enable; copy **Client ID** and **Client Secret** from Google Cloud |
| **Apple** | Enable; follow Supabase Apple setup (Service ID, key `.p8`, Team ID, Key ID) |

**Authentication → URL configuration** — add redirect URL (required for mobile):

`com.mangalam.mangalamapp://login-callback`

Use project **behlrsqilhzhniglhgqh** (same as production API + mobile defaults).

## 2. Google Cloud Console

1. Create OAuth clients:
   - **Web client** → use as `GOOGLE_WEB_CLIENT_ID` in Flutter **and** in Supabase Google provider (client id; secret only in Supabase).
   - **iOS** → bundle `com.mangalam.mangalamApp`; use as `GOOGLE_IOS_CLIENT_ID` in `dart_defines.json`.
   - **Android** → package `com.mangalam.mangalam_app`; add **SHA-1** from your keystore (`keytool -list -v -keystore ~/.android/debug.keystore` for debug).

2. Flutter `dart_defines.json` (from `dart_defines.example.json`):

```json
"GOOGLE_WEB_CLIENT_ID": "xxxx.apps.googleusercontent.com",
"GOOGLE_IOS_CLIENT_ID": "yyyy.apps.googleusercontent.com"
```

3. **iOS only:** In Xcode → Runner → Info → URL Types, add reversed iOS client id: `com.googleusercontent.apps.YYYY`.

## 3. Apple Developer

1. App ID `com.mangalam.mangalamApp` → enable **Sign in with Apple**.
2. Create **Services ID** + key for Supabase (per [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple)).
3. Xcode → Runner → **Signing & Capabilities** → **Sign in with Apple** (entitlements file `Runner.entitlements` in repo).

## 4. Run app

```bash
cd mobile
cp dart_defines.example.json dart_defines.json
# fill SUPABASE_*, GOOGLE_*, API_BASE_URL
flutter run --dart-define-from-file=dart_defines.json
```

## 5. Phone OTP (optional)

Still available via **Continue with phone OTP**; requires MSG91 DLT (`docs/MSG91_OTP.md`).
