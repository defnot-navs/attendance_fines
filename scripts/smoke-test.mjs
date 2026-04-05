const rawBase = process.argv[2] || process.env.API_BASE_URL || 'https://attendance-fines.onrender.com/api';
const base = rawBase.replace(/\/+$/, '');

function nowMs() {
  return Date.now();
}

async function checkEndpoint(path, label) {
  const url = `${base}${path}`;
  const start = nowMs();
  const response = await fetch(url, { cache: 'no-store' });
  const duration = nowMs() - start;
  const text = await response.text();

  return {
    label,
    path,
    url,
    ok: response.ok,
    status: response.status,
    duration,
    preview: text.slice(0, 180).replace(/\s+/g, ' '),
  };
}

async function main() {
  console.log(`Running smoke test against: ${base}`);

  const coldStart = await checkEndpoint('/health', 'Health (cold-start check)');
  const warmStart = await checkEndpoint('/health', 'Health (warm check)');

  const checks = [
    coldStart,
    warmStart,
    await checkEndpoint('/students', 'Students list'),
    await checkEndpoint('/fines-summary', 'Fines summary'),
  ];

  let hasFailure = false;
  for (const check of checks) {
    const statusWord = check.ok ? 'PASS' : 'FAIL';
    console.log(`\n[${statusWord}] ${check.label}`);
    console.log(`URL: ${check.url}`);
    console.log(`Status: ${check.status}`);
    console.log(`Time: ${check.duration} ms`);
    if (!check.ok) {
      hasFailure = true;
      console.log(`Body preview: ${check.preview}`);
    }
  }

  const coldGap = coldStart.duration - warmStart.duration;
  if (coldGap > 500) {
    console.log('\nNote: First request is slower than warm request (expected on free-tier cold starts).');
  }

  if (hasFailure) {
    console.error('\nSmoke test failed. Investigate failing endpoints before frontend QA.');
    process.exit(1);
  }

  console.log('\nSmoke test passed. API is ready for frontend validation.');
}

main().catch((error) => {
  console.error('Smoke test crashed:', error?.message || error);
  process.exit(1);
});
