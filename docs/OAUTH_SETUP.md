# Google & Apple sign-in (Mangalam mobile)

Official reference for Google on Flutter:  
[Supabase — Login with Google (Flutter)](https://supabase.com/docs/guides/auth/social-sign-in/auth-google?queryGroups=platform&platform=flutter-mobile)

Login uses **Supabase Auth** (`signInWithIdToken` for native Google/Apple; browser OAuth fallback).

## 1. Supabase Dashboard (behlrsqilhzhniglhgqh)

**Authentication → Providers → Google**

| Setting | Value |
|---------|--------|
| Enabled | On |
| Client ID (secret) | Web client ID + secret from Google Cloud |
| **Client IDs** | Comma-separated: **Web client ID first**, then iOS client ID, then Android client ID (all OAuth clients from Google Cloud) |
| **Skip nonce check** | **On** (required for iOS native `google_sign_in`) |

**Authentication → Providers → Apple** — enable per [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple).

**Authentication → URL configuration** — redirect URL:

`com.mangalam.mangalamapp://login-callback`

## 2. Google Cloud Console

Create OAuth clients (Google Auth Platform → Clients):

| Type | App details |
|------|-------------|
| **Web** | Authorized redirect URI = Supabase callback (Dashboard → Google provider). Used as `GOOGLE_WEB_CLIENT_ID` and Supabase web client. |
| **iOS** | Bundle ID `com.mangalam.mangalamApp` → `GOOGLE_IOS_CLIENT_ID` |
| **Android** | Package `com.mangalam.mangalam_app` + **SHA-1** (debug + release keystores) |

Add **both** debug and release SHA-1 on Android. Register **every** client ID in Supabase **Client IDs** (web first).

Scopes (Google Cloud → Data access): `openid`, `userinfo.email`, `userinfo.profile` (defaults).

## 3. Flutter app config

`mobile/dart_defines.json` (from `dart_defines.example.json`):

```json
"GOOGLE_WEB_CLIENT_ID": "xxxx.apps.googleusercontent.com",
"GOOGLE_IOS_CLIENT_ID": "yyyy.apps.googleusercontent.com"
```

- **Android:** `GOOGLE_WEB_CLIENT_ID` only (server client ID for `google_sign_in`).
- **iOS:** both IDs; native sign-in is used when `GOOGLE_IOS_CLIENT_ID` is set.

### iOS: reversed client ID in Info.plist

Supabase requires a **CFBundleURLSchemes** entry with the reversed iOS client ID.

1. From `GOOGLE_IOS_CLIENT_ID` `123-abc.apps.googleusercontent.com` → reversed scheme  
   `com.googleusercontent.apps.123-abc`
2. Copy `mobile/ios/Flutter/GoogleSignIn.xcconfig.example` → `GoogleSignIn.xcconfig`
3. Set `GOOGLE_REVERSED_CLIENT_ID` to that string (already wired in `Runner/Info.plist`).

Or compute via `AppConfig.googleIosReversedClientId` when filling the xcconfig.

## 4. Apple Developer

1. App ID `com.mangalam.mangalamApp` → **Sign in with Apple**
2. Services ID + key for Supabase
3. Xcode → **Sign in with Apple** (`Runner.entitlements` in repo)

## 5. Run app

```bash
cd mobile
cp dart_defines.example.json dart_defines.json
# fill SUPABASE_*, GOOGLE_*, API_BASE_URL
cp ios/Flutter/GoogleSignIn.xcconfig.example ios/Flutter/GoogleSignIn.xcconfig  # iOS only
flutter run --dart-define-from-file=dart_defines.json
```

Native Google flow (in app): `google_sign_in` → `authorizationForScopes` / `authorizeScopes` (`email`, `profile`) → `supabase.auth.signInWithIdToken` with **id token + access token**. If client IDs are missing, the app falls back to browser OAuth + deep link.

## 6. Phone OTP (optional)

**Continue with phone OTP**; requires MSG91 DLT — `docs/MSG91_OTP.md`.
