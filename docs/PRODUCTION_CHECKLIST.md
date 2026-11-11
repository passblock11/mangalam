# Mangalam production checklist (strict)

## Already deployed
- API: https://mangalam-api.vercel.app (`/v1/health` OK)
- Mobile defaults: Supabase **behlrsqilhzhniglhgqh**, API URL above
- Auth: **Google only** (native or browser OAuth)

## You must enable (Supabase → behlr project)

1. **Authentication → Providers → Google** — enable; Web client ID + secret; **Client IDs** = Web, iOS, Android (comma-separated, **Web first**); **Skip nonce check** = on. See `docs/OAUTH_SETUP.md`.
2. **Authentication → URL configuration** → Redirect URLs:
   - `com.mangalam.mangalamapp://login-callback`
3. **Google Cloud** — Android SHA-1(s), iOS bundle `com.mangalam.mangalamApp`, `GOOGLE_*` in `dart_defines.json`, iOS `GoogleSignIn.xcconfig` reversed client ID.

## Run mobile
```bash
cd mobile
flutter run --dart-define-from-file=dart_defines.json
```

## Flow after this PR
Login → (onboarding if profile incomplete) → Home tabs → API JWT works.
