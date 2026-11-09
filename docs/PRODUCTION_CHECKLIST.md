# Mangalam production checklist (strict)

## Already deployed
- API: https://mangalam-api.vercel.app (`/v1/health` OK)
- Mobile defaults: Supabase **behlrsqilhzhniglhgqh**, API URL above
- Auth: Google/Apple (browser or native) + optional phone OTP (MSG91 DLT)

## You must enable (Supabase → behlr project)

1. **Authentication → Providers** → enable **Google** and **Apple** (client IDs/secrets from Google Cloud + Apple Developer).
2. **Authentication → URL configuration** → Redirect URLs:
   - `com.mangalam.mangalamapp://login-callback`
3. **Authentication → Providers → Google** → use the same Web client as Google Cloud OAuth.

## Phone SMS (optional)
- MSG91 DLT template + `MSG91_OTP_TEMPLATE_ID` on Vercel `mangalam-api` — see `docs/MSG91_OTP.md`.

## Run mobile
```bash
cd mobile
flutter run --dart-define-from-file=dart_defines.json
```

## Flow after this PR
Login → (onboarding if profile incomplete) → Home tabs → API JWT works.
