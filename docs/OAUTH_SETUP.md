# Google sign-in — Flutter mobile (iOS & Android)

Follow the **Flutter (iOS and Android)** section only (not web OAuth):

https://supabase.com/docs/guides/auth/social-sign-in/auth-google?platform=flutter-mobile

The app uses **native** `google_sign_in` → `supabase.auth.signInWithIdToken` (no browser, no `localhost`, no `signInWithOAuth` on mobile).

## 1. Google Cloud — OAuth clients

| Client | Settings |
|--------|----------|
| **Web** | Used as Supabase Google provider secret + Flutter `GOOGLE_WEB_CLIENT_ID` (`serverClientId`) |
| **Android** | Package `com.mangalam.mangalam_app` + **SHA-1** (debug + release). `cd mobile && ./scripts/android_sha1.sh` for debug. |
| **iOS** | Bundle ID `com.mangalam.mangalamApp` → `GOOGLE_IOS_CLIENT_ID` |

## 2. Supabase (behlrsqilhzhniglhgqh)

**Authentication → Providers → Google**

- Enable Google (Web client ID + secret).
- **Client IDs**: Web, iOS, Android client IDs, **comma-separated, Web first**.
- **Skip nonce check**: **ON** (required for iOS native).

Redirect URLs / Site URL are **not** used for native mobile Google login.

## 3. Flutter

`mobile/dart_defines.json` (see `dart_defines.example.json`):

```json
"GOOGLE_WEB_CLIENT_ID": "xxxx.apps.googleusercontent.com",
"GOOGLE_IOS_CLIENT_ID": "yyyy.apps.googleusercontent.com"
```

- **Android**: `GOOGLE_WEB_CLIENT_ID` required.
- **iOS**: both IDs + reversed client ID in `ios/Flutter/GoogleSignIn.xcconfig` (from `GoogleSignIn.xcconfig.example`).

```bash
cd mobile
flutter run --dart-define-from-file=dart_defines.json
```

Optional: set `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` on Vercel `mangalam-api`; the app loads them from `GET /v1/public/mobile-config` if missing in dart_defines.

## 4. iOS Info.plist

Reversed iOS client URL scheme is already wired via `$(GOOGLE_REVERSED_CLIENT_ID)` in `Runner/Info.plist` (see Supabase doc snippet).
