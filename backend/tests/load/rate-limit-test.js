// backend/tests/load/rate-limit-test.js
//
// k6 Load Test — Rate Limit Verification
//
// Purpose:
//   Drive enough traffic at the rate-limited /api/guest/chat (and secondary
//   endpoints) to verify that:
//     1. Normal traffic (below the limit) receives 200/201 responses.
//     2. Traffic that exceeds the limit receives HTTP 429 Too Many Requests.
//     3. The X-RateLimit-* headers are present on all responses.
//     4. The API does NOT return 500 under sustained load.
//
// Run locally (requires k6 CLI):
//   k6 run backend/tests/load/rate-limit-test.js
//
// Run with custom target:
//   k6 run --env BASE_URL=http://localhost:5000 backend/tests/load/rate-limit-test.js
//
// CI note: This script is intended for manual execution or a dedicated
// load-testing step, not as part of the standard Jest/Playwright suite.
// Add to CI only if a dedicated load-test job is configured.
//
// Docs: https://k6.io/docs/

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ─── Custom Metrics ─────────────────────────────────────────────────────────
const rateLimitedRate = new Rate('rate_limited');        // % requests that got 429
const serverErrorRate = new Rate('server_error');        // % requests that got 5xx
const okRate          = new Rate('ok_responses');        // % 200/201/204
const p95Latency      = new Trend('p95_latency', true);  // p95 response time (ms)
const rateLimitCount  = new Counter('rate_limit_hits');  // total 429 count

// ─── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:5000';

// Warm-up → ramp up → sustained burst → cool-down
export const options = {
  stages: [
    { duration: '15s', target: 5  },   // Warm-up: 5 VUs for 15 s
    { duration: '30s', target: 30 },   // Ramp up: 30 VUs for 30 s (should trigger rate-limit)
    { duration: '30s', target: 30 },   // Sustained: hold 30 VUs for 30 s
    { duration: '15s', target: 0  },   // Cool-down: ramp to 0
  ],
  thresholds: {
    // Under burst load, some 429s are expected (rate limiter doing its job).
    // Overall success+rateLimit rate must cover ≥ 99 % of responses —
    // i.e., virtually zero 5xx errors.
    'server_error': ['rate<0.01'],              // < 1 % 5xx
    'http_req_failed': ['rate<0.50'],           // k6 "failed" = non-2xx; 429s inflate this
    'http_req_duration{expected_response:true}': ['p(95)<3000'], // p95 < 3 s for 2xx
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function checkRateLimitHeaders(res) {
  // Rate-limit headers should be present on every response from a limited route.
  // Accept either RateLimit-* (RFC 6585) or X-RateLimit-* (common convention).
  const hasLimit =
    res.headers['X-RateLimit-Limit'] !== undefined ||
    res.headers['RateLimit-Limit'] !== undefined;
  const hasRemaining =
    res.headers['X-RateLimit-Remaining'] !== undefined ||
    res.headers['RateLimit-Remaining'] !== undefined;
  return hasLimit && hasRemaining;
}

function guestChatPayload(i) {
  return JSON.stringify({
    message: `k6 load test message ${i} — please ignore`,
    sessionId: `k6-session-${__VU}-${i}`,
  });
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// ─── Main VU Script ───────────────────────────────────────────────────────────
export default function () {
  // Each VU sends a burst of 3 requests per iteration to help trigger limits.
  for (let i = 0; i < 3; i++) {
    group('POST /api/guest/chat', () => {
      const res = http.post(
        `${BASE_URL}/api/guest/chat`,
        guestChatPayload(i),
        { headers: jsonHeaders, tags: { name: 'guest_chat' } }
      );

      p95Latency.add(res.timings.duration);

      const is429 = res.status === 429;
      const is5xx = res.status >= 500;
      const is2xx = res.status >= 200 && res.status < 300;

      rateLimitedRate.add(is429);
      serverErrorRate.add(is5xx);
      okRate.add(is2xx);

      if (is429) rateLimitCount.add(1);

      check(res, {
        'status is not 5xx':     (r) => r.status < 500,
        'status is 200 or 429':  (r) => r.status === 200 || r.status === 201 || r.status === 429,
        'has rate-limit headers': (r) => checkRateLimitHeaders(r),
        'response time < 5s':    (r) => r.timings.duration < 5000,
      });

      // If rate-limited, back off briefly before next request.
      if (is429) sleep(0.5);
    });
  }

  // ── Secondary endpoint: GET /health (must stay fast under load) ────────────
  group('GET /health', () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { name: 'health_check' },
    });
    check(res, {
      'health returns 200': (r) => r.status === 200,
      'health fast (<500ms)': (r) => r.timings.duration < 500,
    });
  });

  // ── Secondary endpoint: POST /api/auth/login (rate-limited, stricter) ──────
  group('POST /api/auth/login (rate-limit check)', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ identifier: 'k6testuser', password: 'wrongpassword' }),
      { headers: jsonHeaders, tags: { name: 'login_rate_limit' } }
    );
    check(res, {
      'login: status is not 5xx': (r) => r.status < 500,
      // Expect 401 (wrong creds) or 429 (rate-limited) — both are fine
      'login: 401 or 429':        (r) => r.status === 401 || r.status === 429 || r.status === 400,
    });
  });

  sleep(0.2); // Small pause between iterations
}

// ─── Setup (runs once before VUs start) ──────────────────────────────────────
export function setup() {
  // Verify the server is reachable before starting load test
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Server health check failed: ${res.status}. Is the backend running at ${BASE_URL}?`);
  }
  console.log(`k6 load test starting against: ${BASE_URL}`);
  return { startTime: new Date().toISOString() };
}

// ─── Teardown (runs once after all VUs finish) ────────────────────────────────
export function teardown(data) {
  console.log(`k6 load test finished. Started at: ${data.startTime}`);
  console.log('Check the summary above for rate_limited and server_error rates.');
}
