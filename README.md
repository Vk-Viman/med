# Med App

A privacy-focused meditation and mood tracker built with Expo and Firebase.

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
