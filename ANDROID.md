# Publishing Bookary to Google Play Store

This app is built with Lovable (TanStack Start + Vite) and wrapped for Android using **Capacitor**. Follow these steps on your local machine (not inside Lovable).

## Prerequisites
- Node 20+ and Bun (or npm)
- **Android Studio** (latest stable) with an Android SDK installed
- A **Google Play Console** developer account ($25 one-time)
- Java 17 (bundled with Android Studio)

## 1. Clone & install
```bash
git clone <your-github-repo-url>
cd <repo>
bun install
```

## 2. Install Capacitor (first time only)
```bash
bun add @capacitor/core @capacitor/android
bun add -d @capacitor/cli
```

## 3. Build the web app
```bash
bun run build
```
This produces the static bundle in `dist/` that Capacitor ships inside the APK/AAB.

## 4. Add the Android platform (first time only)
```bash
npx cap add android
```
This creates an `android/` folder — a real native Gradle project. Commit it to git.

## 5. Sync web build → Android (every time you change code)
```bash
bun run build && npx cap sync android
```

## 6. Open in Android Studio
```bash
npx cap open android
```
- Wait for Gradle sync to finish.
- Plug in an Android phone (USB debugging on) or start an emulator.
- Click **Run ▶** to test.

## 7. App identity
Edit `capacitor.config.ts`:
- `appId` — reverse-DNS bundle id (e.g. `app.bookary.reader`). **Cannot be changed after first Play upload.**
- `appName` — display name.

Update the app icon: put a 1024×1024 PNG at `resources/icon.png` and run:
```bash
bunx @capacitor/assets generate --android
```

## 8. Sign the release build (one time)
Generate an upload keystore — keep it forever, backed up:
```bash
keytool -genkey -v -keystore bookary-upload.keystore \
  -alias bookary -keyalg RSA -keysize 2048 -validity 10000
```
In Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)** → point it at the keystore. Or in `android/app/build.gradle` add a `signingConfigs.release` block.

## 9. Build the release AAB
In Android Studio: **Build → Generate Signed Bundle → AAB → release**. Output: `android/app/release/app-release.aab`.

## 10. Upload to Play Console
1. https://play.google.com/console → **Create app**.
2. Fill Store listing (title, short/long description, screenshots — required sizes: phone 1080×1920+, 512×512 icon, 1024×500 feature graphic).
3. Content rating questionnaire, target audience, data safety, privacy policy URL.
4. **Production → Create new release → upload the .aab**.
5. Send for review (first review takes 1–7 days).

## Updating the app later
1. Ship changes through Lovable → GitHub as usual.
2. Locally: `git pull && bun install && bun run build && npx cap sync android`.
3. Bump `versionCode` (integer, +1) and `versionName` in `android/app/build.gradle`.
4. Rebuild signed AAB, upload to Play Console as a new release.

## Notes on backend / auth
- Supabase auth works via HTTPS out of the box — the app loads over the `https://localhost` Capacitor scheme.
- For Google OAuth on Android specifically, later you'll want the `@capacitor/browser` or `@capacitor-community/google-auth` plugin so the OAuth flow opens in a Custom Tab. Not required for launch — email/password works immediately.
- Deep links (opening `bookary://...` URLs) can be added later via `AndroidManifest.xml` intent filters.

## Common issues
- **White screen on device**: you forgot `bun run build && npx cap sync android` after code changes.
- **`SDK location not found`**: open Android Studio once so it writes `local.properties`.
- **`Duplicate class`** during Gradle build: run `cd android && ./gradlew clean`.
- **Play rejects the AAB for missing target SDK**: bump `targetSdkVersion` in `android/variables.gradle` to the current Play requirement (35+ as of 2026).
