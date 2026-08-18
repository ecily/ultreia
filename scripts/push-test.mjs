const API_BASE = 'https://api.ultreia.app/api';
const ALLOWED_DEVICE_ID = 'ultreia-msxhx1mg-hmc3d7sx3v';

function fail(message) {
  console.error(`Push-Test: ${message}`);
  process.exitCode = 2;
}

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--device' || args[1] !== ALLOWED_DEVICE_ID) {
  fail(`nur --device ${ALLOWED_DEVICE_ID} ist erlaubt`);
} else if (!process.env.PUSH_TEST_KEY) {
  fail('PUSH_TEST_KEY ist in dieser Shell nicht gesetzt');
} else {
  const response = await fetch(`${API_BASE}/push/test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ultreia-test-key': process.env.PUSH_TEST_KEY,
    },
    body: JSON.stringify({
      deviceId: ALLOWED_DEVICE_ID,
      title: 'Ultreia Server Push Test',
      message: 'Autorisierter Production-Test.',
    }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  console.log(`Backend HTTP: ${response.status}`);
  console.log(`Push request accepted: ${payload.ok === true ? 'ja' : 'nein'}`);
  console.log(`Expo Ticket: ${payload.ticket || (payload.ok ? 'akzeptiert' : payload.status || 'Fehlerklasse')}`);
  console.log(`Receipt: ${payload.receipt || 'offen'}`);
  if (!response.ok || payload.ok !== true) process.exitCode = 1;
}
