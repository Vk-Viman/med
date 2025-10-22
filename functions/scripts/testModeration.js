// Simple local test runner for the moderateText function
// Usage (from functions/):
//   node scripts/testModeration.js "You are awful and I hate you"

const url = process.env.MOD_URL || 'http://127.0.0.1:5001/calmspace-4c73f/us-central1/moderateText';
const text = process.argv[2] || 'You are awful and I hate you';

async function main() {
  const body = { text };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-emulator-bypass': '1',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(JSON.stringify({ ok: res.ok, status: res.status, data }, null, 2));
    if (!res.ok) process.exitCode = 1;
  } catch (e) {
    console.error('Request failed:', e.message);
    process.exitCode = 1;
  }
}

main();
