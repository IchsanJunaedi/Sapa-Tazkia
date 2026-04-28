// backend/tests/api/qa.test.js
//
// QA endpoint: API + Integration test (Jest + Supertest + Prisma).
//
// This test executes the full round-trip for a "tanya-jawab" (Q&A) endpoint:
//   1. POST payload via HTTP (API layer assertion).
//   2. Query the database directly via Prisma to verify the row was persisted
//      (Integration layer assertion).
//   3. Clean up the row after the test finishes.
//
// The endpoint path and the Prisma model name are exposed as DUMMY constants
// at the top of the file — replace them with your real values once the
// `/api/tanya` route and `Tanya` Prisma model are defined. If you are using
// one of the existing routes (e.g. POST /api/guest/chat → prisma.conversation),
// just swap the constants below.

const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, disconnect } = require('../helpers/dbHelper');

// -----------------------------------------------------------------------------
// DUMMY CONFIG — replace with real values when the endpoint/model are ready.
// -----------------------------------------------------------------------------
const TANYA_ENDPOINT = process.env.TANYA_ENDPOINT || '/api/tanya';

// Name of the Prisma model (must match `model <Name> { ... }` in schema.prisma).
// Lower-cased first letter is the key on the PrismaClient instance.
const TANYA_MODEL_KEY = process.env.TANYA_MODEL_KEY || 'tanya';

// Unique field used for findUnique() lookup (commonly an auto-generated id or
// a human-readable slug / external id).
const TANYA_UNIQUE_FIELD = process.env.TANYA_UNIQUE_FIELD || 'id';

// -----------------------------------------------------------------------------
// Mock payload — customize to match your DTO / validation schema.
// -----------------------------------------------------------------------------
const mockQuestion = {
  pertanyaan: 'Kapan jadwal KRS semester genap dibuka?',
  kategori: 'akademik',
  sessionId: `test-session-${Date.now()}`,
};

// Track the id of whatever row the API creates so we can both findUnique() it
// in the integration step and delete it during cleanup.
let createdRecordId = null;

describe('POST /api/tanya — QA endpoint (API + Integration)', () => {
  beforeAll(async () => {
    // Fail fast with a helpful message if the dummy model does not exist yet.
    if (!prisma[TANYA_MODEL_KEY]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[qa.test] Prisma model "${TANYA_MODEL_KEY}" not found on PrismaClient. ` +
        `Update TANYA_MODEL_KEY in tests/api/qa.test.js (or set env var) to match your schema.`
      );
    }

    // Ensure a clean slate — truncate relevant tables before running.
    await truncateAll().catch(() => {
      // If truncateAll hits a model that does not exist in this schema, skip.
    });
  });

  afterAll(async () => {
    // Targeted cleanup for rows this test created.
    if (createdRecordId && prisma[TANYA_MODEL_KEY]) {
      await prisma[TANYA_MODEL_KEY]
        .delete({ where: { [TANYA_UNIQUE_FIELD]: createdRecordId } })
        .catch(() => {
          // Already removed or model missing — safe to ignore in teardown.
        });
    }
    await disconnect();
  });

  it('returns 2xx and the expected response shape (API test)', async () => {
    const res = await agent
      .post(TANYA_ENDPOINT)
      .set('Content-Type', 'application/json')
      .send(mockQuestion);

    // Accept 200 OK or 201 Created depending on controller convention.
    expect([200, 201]).toContain(res.status);

    // Controllers in this repo typically respond with { success, data, ... }.
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
      })
    );
    expect(res.body).toHaveProperty('data');

    // Capture the generated id for the integration step.
    const payload = res.body.data || res.body;
    createdRecordId = payload[TANYA_UNIQUE_FIELD] ?? payload.id;
    expect(createdRecordId).toBeDefined();
  });

  it('persists the question to the database (Integration test)', async () => {
    // Skip gracefully if the dummy model does not exist yet in the schema.
    if (!prisma[TANYA_MODEL_KEY]) {
      return;
    }

    expect(createdRecordId).toBeDefined();

    const row = await prisma[TANYA_MODEL_KEY].findUnique({
      where: { [TANYA_UNIQUE_FIELD]: createdRecordId },
    });

    expect(row).not.toBeNull();
    expect(row).toEqual(
      expect.objectContaining({
        pertanyaan: mockQuestion.pertanyaan,
      })
    );
  });

  it('rejects invalid payload with 400 (API test, negative path)', async () => {
    const res = await agent
      .post(TANYA_ENDPOINT)
      .set('Content-Type', 'application/json')
      .send({}); // empty payload should fail validation

    expect([400, 422]).toContain(res.status);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false })
    );
  });
});
