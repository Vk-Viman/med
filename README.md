# Med App

A privacy-focused meditation and mood tracker built with Expo (React Native) and Firebase.

## Features

- Guided meditation player, background sounds, and daily plan
- Mood & stress tracking with charts and exports (JSON/CSV/Markdown)
- End-to-end encrypted notes with optional passphrase protection
- Dark/Light theme with persistent preference
- Reminders/notifications and auto-lock with optional biometric unlock
- Community feed and basic badges
- Remote wipe and local-only mode

## Project structure

- `my-app/app/` — screens and router
- `my-app/src/services/` — app services (encryption, profile, etc.)
- `my-app/src/components/` — reusable UI components
- `my-app/src/theme/` — theme provider and palette
- `my-app/firebase/` — Firebase config

## Prerequisites

- Node.js LTS
- A Firebase project with Email/Password auth and Firestore enabled

## Setup

1) Install dependencies

```powershell
# from my-app
npm install
```

2) Configure Firebase

Edit `my-app/firebase/firebaseConfig.js` with your Firebase project keys (apiKey, authDomain, projectId, etc.).

3) Start the app

```powershell
# clear cache (optional if you hit bundler issues)
npx expo start -c

# or just
npx expo start
```

Use the Expo Go app or an emulator (Android/iOS) to run the project.

## Environment and scripts

Package scripts in `my-app/package.json`:

- `npm run start` — Start Expo bundler
- `npm run android` — Start and open Android
- `npm run ios` — Start and open iOS (macOS)
- `npm run web` — Start in web

## Troubleshooting

- Stuck bundler/metro cache: run `npx expo start -c`.
- Firebase permission errors: ensure Firestore rules and Email/Password auth are enabled.
- Notifications on device: ensure permissions are granted and the device supports them.

## Security

This app is designed so that your private notes are end-to-end encrypted before they leave your device. Below is a concise overview of how encryption and key management work, what optional passphrase protection does, how to migrate old data, and how to safely use escrow.

- Encryption algorithm
  - AES-256-CBC with PKCS7 padding ("v2").
  - Every note is encrypted with a fresh random 16-byte IV. The IV is stored next to the ciphertext.

- Device encryption key
  - A random 32-byte key is generated on the device and stored in the platform keystore (SecureStore). A fallback Base64 cache is kept in AsyncStorage for emulator resets.
  - The device key never leaves your device unless you explicitly export a passphrase-wrapped escrow blob.

- Optional passphrase protection (recommended)
  - You can enable a passphrase layer that wraps the device key using PBKDF2 (SHA-256, 100k iterations) and AES-256-CBC with a random IV.
  - When enabled, the plaintext device key is removed from at-rest storage and kept only in memory after you unlock with your passphrase. On app restart, you must unlock again.
  - Controls live in Settings → Encryption: Enable/Disable, Unlock for this session, and Lock Now.

- Legacy data migration
  - Earlier versions might have used a deterministic scheme. Use Settings → Encryption → Legacy Migration to dry-run (detect) and run the migration that re-encrypts legacy entries with v2 (random IV per entry). This preserves your content while modernizing its protection.

- Key escrow (multi-device recovery)
  - You can create an escrow blob that contains your device key encrypted with a passphrase-derived key (PBKDF2). Store this JSON securely (e.g., a password manager or an offline secure vault).
  - Best practices:
    - Choose a strong, memorable passphrase (length + variety). Do not reuse your account password.
    - Keep at least one safe backup copy of the escrow JSON. If you lose both the device key and escrow, your encrypted notes cannot be recovered.
    - Never share the escrow or passphrase publicly.
  - Importing escrow on a device restores the encryption key for that device.

- Remote wipe
  - If a remote wipe is requested, the app deletes all mood entries and clears encryption materials from both AsyncStorage and the platform keystore (SecureStore). You can restore access later via escrow import if desired.

- Threat model (high level)
  - Notes are encrypted on-device with a per-device key. With passphrase mode enabled, the key is only in memory after you unlock, reducing at-rest exposure even if the keystore is compromised. Anyone without your passphrase (and escrow or physical unlocked device) should not be able to read your notes.

If you have questions or suggestions about the security model, please open an issue or start a discussion.

## Usage (quick tour)

- Sign up or log in with email and password.
- Track mood & stress; add a private note (encrypted on-device).
- View weekly report and charts.
- Enable Dark Mode in Settings.
- Optional: Enable passphrase protection (Settings → Encryption) and create/export a key escrow for recovery.
- Export your data (JSON/CSV/Markdown) from Settings → Data Management.

## Firebase configuration

- Authentication: Enable Email/Password in Firebase Console.
- Firestore: Create a database in production or test mode. Example minimal rules (tighten as needed):

```javascript
// Firestore Security Rules (example baseline)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /moods/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Data model (high-level)

- `users/{uid}`: profile fields (email, displayName, avatarB64, themeMode, biometricEnabled, analyticsOptOut, sessionEpoch, termsAcceptedVersion, privacyAcceptedAt, wipeRequested, etc.)
- `users/{uid}/moods/{id}`: mood, stress, createdAt, encVer, noteCipher, noteIv, noteAlg. Legacy entries may have `note` (to be migrated).

## Build & release (overview)

- Development: run locally with Expo (see Setup).
- Native builds: you can integrate with EAS Build for generating APK/AAB or IPA. See Expo docs for `eas build` configuration.

## Screenshots

Add screenshots of the Home, Mood Tracker, Report, and Settings screens here.

## Contributing

Issues and pull requests are welcome. Please follow conventional commit messages and keep PRs focused.

## License

0BSD (see package.json)

## Contact

Open an issue or discussion in this repository for questions or support.
