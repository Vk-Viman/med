const fs = require('fs');
const PDFDocument = require('pdfkit');

const outPath = '../Member3_Viva.pdf';
const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream(__dirname + '/' + outPath));

// Content: short viva script + snippets with file:line ranges
const title = 'Member 3 (IT23227118) — Viva Script & Code Snippets';
doc.fontSize(14).text(title, { align: 'center' });
doc.moveDown(0.5);

const script = `Short Viva Script (read aloud):

1) Intro (10s): "I implemented mood & stress tracking UX plus privacy features: quick mood logging, stress slider, journal with client-side encryption, biometric unlock, offline queue and export."

2) Key components (40s):
 - Home screen / insights: uses cached chart rows and prefers numeric moodScore but maps textual moods when needed.
 - Mood entries: note text is encrypted client-side before upload; offline queue ensures reliability.
 - Biometric unlock: uses device biometrics via Expo LocalAuthentication for quick app unlock.

3) Security (30s):
 - Device DataKey stored in SecureStore; AES-256-CBC (per-entry IV) used for encrypting notes. Server stores only ciphertext + iv.
 - Passphrase wrapping is supported (wrapped blob) to enable cross-device recovery.

Demo steps to show in app (30s):
 - Create a mood entry with a short note.
 - Show Firestore entry (or app console) to point out ciphertext fields (noteCipher, noteIv).
 - Lock app and use Biometric Login to resume.\n`;

doc.fontSize(10).text(script);
doc.moveDown(0.5);

const snippetHeader = 'Code snippets to reference (file : startLine - endLine):';
doc.fontSize(11).text(snippetHeader);
doc.moveDown(0.2);

const snippets = [
  { file: 'my-app/src/services/moodEntries.js', range: 'lines 52-110', note: 'getOrCreateSecureKey + encryptV2' },
  { file: 'my-app/src/services/moodEntries.js', range: 'lines 103-110', note: 'decryptV2' },
  { file: 'my-app/src/services/moodEntries.js', range: 'lines 150-168', note: 'createMoodEntry (encrypt before send)' },
  { file: 'my-app/app/biometricLogin.js', range: 'lines 1-80', note: 'handleBiometric() flow & UI' },
  { file: 'my-app/app/index.js', range: 'lines 80-96', note: 'getChartDataSince usage and mood series selection' },
];

// Add verbatim Settings snippets to include in the one-page PDF for viva reference
const settingsSnippets = [
  {
    title: 'Test Biometric Login (handler)',
    code: `const testBiometricLogin = async () => {\n  try {\n    const hasHardware = await LocalAuthentication.hasHardwareAsync();\n    const enrolled = await LocalAuthentication.isEnrolledAsync();\n    if (!hasHardware) { Alert.alert(\"Not Available\", \"This device does not support biometric authentication.\"); return; }\n    if (!enrolled) { Alert.alert(\"Not Enrolled\", \"No biometric credentials are enrolled on this device.\"); return; }\n    const result = await LocalAuthentication.authenticateAsync({ promptMessage: \"Authenticate with biometrics\" });\n    if (result.success) { Alert.alert(\"Success\", \"Biometric authentication successful! ✓\"); } else { Alert.alert(\"Failed\", \"Biometric authentication failed.\"); }\n  } catch (e) { Alert.alert(\"Error\", e.message || \"An error occurred during biometric authentication.\"); }\n};`
  },
  {
    title: 'Local-Only Toggle (UI binding)',
    code: ` { key:'localOnly', type:'toggle', label:'Local-Only Mode', value: localOnly, onValueChange: toggleLocalOnly },`
  },
  {
    title: 'Export / Delete Data actions',
    code: ` { key:'export', type:'action', label: exporting? 'Exporting...' : 'Export Data', onPress: ()=>{ Alert.alert('Export Format', ... ) } },\n { key:'delAll', type:'action', label:'Delete All Data', danger:true, onPress: confirmDeleteAll }`
  },
  {
    title: 'Key Escrow buttons (Store / Export / Import)',
    code: `PrimaryButton title={escrowing? 'Saving...' : 'Store Escrow'} onPress={handleCreateEscrow} /\nPrimaryButton title='Export Escrow JSON' onPress={handleExportEscrow} /\nPrimaryButton title={importing? 'Importing...' : 'Test Import'} onPress={handleImportEscrow}`
  },
  {
    title: 'Enable Passphrase Protection (UI + handler)',
    code: `PrimaryButton title={busyEnc? 'Enabling...' : 'Enable Passphrase Protection'} onPress={async()=>{ if(!encPass || encPass!==encPass2){ Alert.alert('Encryption','Enter matching passphrases.'); return; } await enablePassphraseProtection(encPass); }} />`
  }
];

// Append settingsSnippets to the PDF content
doc.moveDown(0.2);
doc.fontSize(11).text('Key Settings snippets (verbatim) — read these in viva:', { underline: true });
doc.moveDown(0.2);
settingsSnippets.forEach(s => {
  doc.font('Helvetica-Bold').fontSize(9).text(s.title);
  doc.font('Courier').fontSize(8).text(s.code, { lineGap: 2 });
  doc.moveDown(0.2);
});

snippets.forEach(s => {
  doc.font('Helvetica-Bold').fontSize(10).text(`${s.file} : ${s.range}`);
  doc.font('Helvetica').fontSize(9).text(`Note: ${s.note}`);
  doc.moveDown(0.2);
});

doc.moveDown(0.5);
doc.fontSize(10).text('Parts to demo in running app:', { underline: true });
doc.moveDown(0.2);
doc.fontSize(9).text('- Home screen: show trend text, sparkline, and streak.');
doc.fontSize(9).text('- MoodTracker: create a mood entry with a short note.');
doc.fontSize(9).text('- Firestore console (or logs): show stored document fields (noteCipher, noteIv).');
doc.fontSize(9).text('- Biometric Login: lock app and demonstrate unlocking.');

doc.end();
console.log('PDF written to', __dirname + '/' + outPath);
