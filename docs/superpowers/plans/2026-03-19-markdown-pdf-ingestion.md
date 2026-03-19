# Markdown Rendering + PDF Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full markdown rendering to AI chat responses and PDF upload support for the admin knowledge base.

**Architecture:** Two independent features. Feature 1 is frontend-only — replace the custom bold-only formatter in `ChatMessage.jsx` with `react-markdown` + syntax highlighting, active only when typing animation completes. Feature 2 is backend + frontend — fix a silent payload field bug in `ragService.addDocument`, add a text chunker utility, add a multer-based PDF upload endpoint, and add a PDF upload form to the admin KB panel.

**Tech Stack:** react-markdown, remark-gfm, react-syntax-highlighter (frontend); multer, pdf-parse (already installed), custom textChunker utility (backend); Jest for unit tests

**Spec:** `docs/superpowers/specs/2026-03-19-markdown-pdf-ingestion-design.md`

---

## File Map

### Feature 1 — Markdown Rendering
- Modify: `frontend/src/components/chat/ChatMessage.jsx` — replace `formatMessageWithBold` with `MarkdownRenderer` component, conditional on `isTyping`

### Feature 2 — PDF Ingestion
- Modify: `backend/src/services/ragService.js` — fix `addDocument` payload to include `text` and `title` fields
- Create: `backend/src/utils/textChunker.js` — pure function to split text into overlapping chunks
- Create: `backend/tests/unit/textChunker.test.js` — unit tests for chunker
- Create: `backend/tests/unit/pdfIngestion.test.js` — unit tests for uploadPdfDoc controller
- Modify: `backend/src/controllers/adminController.js` — add `uploadPdfDoc` handler + multer instance
- Modify: `backend/src/routes/adminRoutes.js` — register `POST /knowledge-base/upload-pdf`
- Modify: `frontend/src/pages/AdminDashboard.jsx` — add PDF upload form to `KnowledgeBaseView`

---

## Task 1: Install Frontend Dependencies

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1.1: Install react-markdown, remark-gfm, react-syntax-highlighter**

```bash
cd frontend
npm install react-markdown remark-gfm react-syntax-highlighter
```

Expected: All three packages appear in `frontend/package.json` dependencies. No peer dependency errors.

- [ ] **Step 1.2: Verify install**

```bash
cd frontend
node -e "require('react-markdown'); require('remark-gfm'); require('react-syntax-highlighter'); console.log('OK')"
```

Expected output: `OK`

---

## Task 2: Add MarkdownRenderer to ChatMessage.jsx

**Files:**
- Modify: `frontend/src/components/chat/ChatMessage.jsx`

- [ ] **Step 2.1: Check for existing `.markdown-body` CSS conflicts**

Before editing, run:

```bash
grep -r "markdown-body" frontend/src/
```

Expected: No results. If any results found, use a more specific class name like `.sapa-markdown` in Steps 2.2 and 2.5 instead of `.markdown-body`.

- [ ] **Step 2.2: Add imports at the top of ChatMessage.jsx**

Open `frontend/src/components/chat/ChatMessage.jsx`. After the existing imports (line 1–3), add:

```javascript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
```

- [ ] **Step 2.3: Add shared arabicRegex and MarkdownRenderer before existing helpers**

Open `ChatMessage.jsx`. After line 12 (the `cleanMessageContent` function ends), insert:

```javascript
// ✅ Shared Arabic detection regex
const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// ✅ Full markdown renderer — used for completed bot messages only (not during typing animation)
const MarkdownRenderer = ({ content }) => {
  const hasArabic = arabicRegex.test(content);

  return (
    <div className={`markdown-body${hasArabic ? ' rtl' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ borderRadius: '8px', fontSize: '0.875rem', marginBottom: '0.75rem' }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          p({ children }) {
            const text = typeof children === 'string' ? children : '';
            if (arabicRegex.test(text)) {
              return (
                <p dir="rtl" style={{ unicodeBidi: 'plaintext', textAlign: 'right', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", fontSize: '18px', fontWeight: '500', lineHeight: '1.8', marginBottom: '0.5rem' }}>
                  {children}
                </p>
              );
            }
            return <p>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
```

- [ ] **Step 2.4a: Remove duplicate arabicRegex from formatMessageWithArabic**

In `ChatMessage.jsx`, find `formatMessageWithArabic` (around line 16 after the new code is inserted). Inside its function body, find and remove this line:

```javascript
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
```

The function should now use the shared `arabicRegex` defined at module scope.

- [ ] **Step 2.4b: Remove duplicate arabicRegex from formatMessageContent**

In `formatMessageContent` (further down in the file), find and remove this line:

```javascript
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
```

Again, the shared module-scope `arabicRegex` covers this.

- [ ] **Step 2.5: Replace the content render block in the ChatMessage component**

Find this block inside `ChatMessage` (around line 184–191 after the new code is inserted):

```javascript
            <div className={`
              ${isUser
                ? 'font-medium text-[15px] leading-relaxed'
                : 'font-normal text-[15px] leading-[1.7] tracking-wide'
              }
            `}>
              {/* Teks yang diformat */}
              {formatMessageContent(displayContent)}
            </div>
```

Replace with:

```javascript
            <div className={`
              ${isUser
                ? 'font-medium text-[15px] leading-relaxed'
                : 'font-normal text-[15px] leading-[1.7] tracking-wide'
              }
            `}>
              {isUser ? (
                // User messages: always plain text, no markdown
                displayContent
              ) : isTyping ? (
                // Bot messages during typing animation: plain text to avoid markdown flicker
                // (partial markdown like **text or ```code can look broken mid-animation)
                formatMessageContent(displayContent)
              ) : (
                // Bot messages after animation completes: full markdown
                // Use message.content (not displayContent) — both are equal at this point,
                // but message.content is the canonical source and avoids stale partial text
                // if the component re-renders during the final animation tick.
                <div style={{ opacity: 1, transition: 'opacity 0.15s ease-in' }}>
                  <MarkdownRenderer content={cleanMessageContent(message.content)} />
                </div>
              )}
            </div>
```

- [ ] **Step 2.6: Add markdown CSS styles to the existing `<style>` block**

Find the `<style>` tag at the bottom of `ChatMessage` (near the end of the file). Inside it, after the existing `.arabic-text` and `.regular-text` rules, add:

```css
        .markdown-body p { margin-bottom: 0.75rem; line-height: 1.7; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
          font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #1f2937;
        }
        .markdown-body h1 { font-size: 1.25rem; }
        .markdown-body h2 { font-size: 1.125rem; }
        .markdown-body h3 { font-size: 1rem; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-body ul { list-style-type: disc; }
        .markdown-body ol { list-style-type: decimal; }
        .markdown-body li { margin-bottom: 0.25rem; line-height: 1.6; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; font-size: 0.875rem; }
        .markdown-body th, .markdown-body td { border: 1px solid rgba(0,0,0,0.15); padding: 0.4rem 0.75rem; text-align: left; }
        .markdown-body th { background: rgba(0,0,0,0.06); font-weight: 600; }
        .markdown-body tr:nth-child(even) { background: rgba(0,0,0,0.03); }
        .markdown-body blockquote { border-left: 3px solid rgba(0,0,0,0.2); padding-left: 0.75rem; margin: 0.5rem 0; color: rgba(0,0,0,0.6); font-style: italic; }
        .markdown-body .inline-code { background: rgba(0,0,0,0.08); padding: 0.1rem 0.35rem; border-radius: 4px; font-family: 'Courier New', Courier, monospace; font-size: 0.875em; color: #c7254e; }
        .markdown-body a { color: #2563eb; text-decoration: underline; }
        .markdown-body a:hover { color: #1d4ed8; }
        .markdown-body hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 1rem 0; }
        .markdown-body.rtl { direction: rtl; text-align: right; }
        .markdown-body strong { font-weight: 600; color: #111827; }
        .markdown-body em { font-style: italic; }
```

- [ ] **Step 2.7: Start the frontend dev server and verify visually**

```bash
cd frontend
npm start
```

Open the chat. Ask the AI:
- *"Buat list 5 jurusan populer di Indonesia"* — expect bullet list
- *"Tulis fungsi Python untuk hitung IPK"* — expect code block with syntax highlight
- *"Buat tabel perbandingan IPK dan predikat kelulusan"* — expect rendered table

Expected: Responses render with proper formatting. User messages stay plain text. Typing animation shows plain text; after animation completes markdown renders.

- [ ] **Step 2.8: Commit**

```bash
git add frontend/src/components/chat/ChatMessage.jsx frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add full markdown rendering with syntax highlighting to chat messages"
```

---

## Task 3: Fix ragService.addDocument Payload

**Files:**
- Modify: `backend/src/services/ragService.js`

**Context:** `addDocument` stores text under `payload.content`, but the search pipeline (`compileContext`) reads `payload.text`. Documents added via `addDocument` are embedded correctly and retrieved by cosine similarity, but their content is empty string in the GPT context. This is a silent data correctness bug that must be fixed before PDF ingestion.

- [ ] **Step 3.1: Fix the payload in addDocument**

In `backend/src/services/ragService.js`, find the `addDocument` method (around line 340). Find the `payload` object construction:

```javascript
      const payload = {
        content,
        source: metadata.source || 'manual',
        category: metadata.category || 'manual',
        createdAt,
        ...metadata
      };
```

Replace with:

```javascript
      const payload = {
        content,
        // `text` is the canonical field read by compileContext (line 205: doc.payload.text)
        // `...metadata` is spread last, so caller-provided text/title will override these defaults
        text: content,
        title: metadata.title || metadata.source || 'Dokumen',
        source: metadata.source || 'manual',
        category: metadata.category || 'manual',
        createdAt,
        ...metadata
      };
```

- [ ] **Step 3.2: Verify the fix doesn't break existing tests**

```bash
cd backend
npm test -- --forceExit
```

Expected: All existing tests still PASS (no new failures).

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/services/ragService.js
git commit -m "fix: add text and title fields to ragService.addDocument payload (fixes silent context bug)"
```

---

## Task 4: Create textChunker Utility (TDD)

**Files:**
- Create: `backend/src/utils/textChunker.js`
- Create: `backend/tests/unit/textChunker.test.js`

- [ ] **Step 4.1: Write failing tests first**

Create `backend/tests/unit/textChunker.test.js`:

```javascript
// backend/tests/unit/textChunker.test.js
const { chunkText } = require('../../src/utils/textChunker');

describe('chunkText', () => {
  it('should return single chunk for text shorter than chunkSize', () => {
    const text = 'Hello world. '.repeat(30); // ~390 chars, under 1500
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });

  it('should return empty array for text shorter than minimum chunk size (100 chars)', () => {
    const text = 'Too short.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(0);
  });

  it('should split long text into multiple chunks', () => {
    const text = 'This is a sentence with enough words. '.repeat(150); // ~5700 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not produce chunks shorter than 100 characters', () => {
    const text = 'Word '.repeat(2000); // 10000 chars
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeGreaterThanOrEqual(100);
    });
  });

  it('should preserve content — first and last unique words appear in output', () => {
    const words = [];
    for (let i = 0; i < 500; i++) words.push(`uniqueword${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text);
    const allText = chunks.join(' ');
    expect(allText).toContain('uniqueword0');
    expect(allText).toContain('uniqueword499');
  });

  it('should include overlap — a unique word near end of chunk[0] also appears in chunk[1]', () => {
    // Build a text with known unique words at predictable positions
    // Section A: 1000 chars of 'alpha' words, Section B: 1000 chars of 'beta' words,
    // Section C: 1000 chars of 'gamma' words — with chunkSize=1500, overlap=200
    // chunk[0] covers ~A+half-B, chunk[1] should start in B (the overlap zone)
    const sectionA = Array.from({ length: 50 }, (_, i) => `alphaword${i}`).join(' '); // ~700 chars
    const sectionB = Array.from({ length: 50 }, (_, i) => `betaword${i}`).join(' ');  // ~700 chars
    const sectionC = Array.from({ length: 50 }, (_, i) => `gammaword${i}`).join(' '); // ~700 chars
    const text = `${sectionA} ${sectionB} ${sectionC}`;

    const chunks = chunkText(text, 1500, 200);
    expect(chunks.length).toBeGreaterThan(1);

    // Due to overlap, at least one word that ends chunk[0] should start chunk[1]
    const lastWordsOfChunk0 = chunks[0].split(' ').slice(-10).filter(Boolean);
    const firstWordsOfChunk1 = new Set(chunks[1].split(' ').slice(0, 30).filter(Boolean));
    const hasOverlap = lastWordsOfChunk0.some((w) => firstWordsOfChunk1.has(w));
    expect(hasOverlap).toBe(true);
  });

  it('should not split on abbreviations — Dr., No., SKS', () => {
    const text =
      'Dr. Budi adalah dosen pengampu mata kuliah. No. 123 adalah nomor ruangan. ' +
      'Nilai SKS 3.75 adalah nilai tertinggi yang bisa dicapai mahasiswa. ' +
      'Mahasiswa wajib memenuhi persyaratan kelulusan yang telah ditetapkan.';
    const chunks = chunkText(text, 80, 10);
    chunks.forEach((chunk) => {
      // No chunk should end with only an abbreviation token
      expect(chunk.trim()).not.toMatch(/\bDr\.?$/);
      expect(chunk.trim()).not.toMatch(/\bNo\.?$/);
    });
  });
});
```


- [ ] **Step 4.2: Run tests to verify they all FAIL**

```bash
cd backend
npm test tests/unit/textChunker.test.js -- --forceExit
```

Expected: All tests FAIL with `Cannot find module '../../src/utils/textChunker'`.

- [ ] **Step 4.3: Create textChunker.js**

Create `backend/src/utils/textChunker.js`:

```javascript
// backend/src/utils/textChunker.js

/**
 * Split text into overlapping chunks suitable for RAG embedding.
 *
 * Sentence boundary detection: looks for punctuation (.!?) followed by
 * a capital letter or newline, where the preceding token is >2 characters.
 * This avoids false splits on abbreviations (Dr., No., SKS) and decimals (3.75).
 *
 * Note: `...metadata` spread in addDocument means caller-provided `text`/`title`
 * fields override the defaults set before the spread.
 *
 * @param {string} text          - Raw text to chunk
 * @param {number} chunkSize     - Target chunk size in characters (default 1500)
 * @param {number} overlap       - Overlap between adjacent chunks in characters (default 200)
 * @param {number} minChunkSize  - Minimum chunk size to keep (default 100)
 * @returns {string[]}           - Array of text chunks
 */
function chunkText(text, chunkSize = 1500, overlap = 200, minChunkSize = 100) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.trim().length < minChunkSize) return [];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    // If not at the end of text, try to find a sentence boundary
    if (end < normalized.length) {
      const windowStart = Math.max(end - 300, start + minChunkSize);
      const windowEnd = Math.min(end + 200, normalized.length);
      const window = normalized.slice(windowStart, windowEnd);

      // Match: 3+ letter word + sentence-ending punctuation + whitespace + (capital letter or newline)
      // Requires 3+ letters before punctuation to avoid: Dr. No. SKS 3.75 1.
      const boundaries = [...window.matchAll(/[a-zA-Z]{3,}[.!?](?=\s+[A-Z\n])/g)];

      if (boundaries.length > 0) {
        // Use the last (rightmost) valid boundary found in the window
        const lastBoundary = boundaries[boundaries.length - 1];
        const boundaryEnd = windowStart + lastBoundary.index + lastBoundary[0].length;
        if (boundaryEnd > start + minChunkSize) {
          end = boundaryEnd;
        }
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }

    // Advance start with overlap
    start = end - overlap;
    if (start >= normalized.length) break;
    if (start < 0) break;
  }

  return chunks;
}

module.exports = { chunkText };
```

- [ ] **Step 4.4: Run tests to verify they all PASS**

```bash
cd backend
npm test tests/unit/textChunker.test.js -- --forceExit
```

Expected: All 7 tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add backend/src/utils/textChunker.js backend/tests/unit/textChunker.test.js
git commit -m "feat: add textChunker utility with sentence-boundary splitting and overlap"
```

---

## Task 5: PDF Ingestion Backend Endpoint (TDD)

**Files:**
- Modify: `backend/src/controllers/adminController.js`
- Modify: `backend/src/routes/adminRoutes.js`
- Create: `backend/tests/unit/pdfIngestion.test.js`

- [ ] **Step 5.1: Install multer**

```bash
cd backend
npm install multer
```

Expected: `multer` appears in `backend/package.json` dependencies.

- [ ] **Step 5.2: Write failing tests**

Create `backend/tests/unit/pdfIngestion.test.js`:

```javascript
// backend/tests/unit/pdfIngestion.test.js
// Mocks must be declared before any require() — Jest hoists jest.mock() to top of file

jest.mock('../../src/services/ragService', () => ({
  addDocument: jest.fn().mockResolvedValue({ id: 'mock-id' })
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
  security: jest.fn(), debug: jest.fn(), redis: jest.fn(), rateLimit: jest.fn()
}));

jest.mock('pdf-parse', () => jest.fn());

// Load modules AFTER mocks are declared
const pdfParse = require('pdf-parse');
const ragService = require('../../src/services/ragService');
const { uploadPdfDoc } = require('../../src/controllers/adminController');

const makeRes = () => {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('uploadPdfDoc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if no file is uploaded', async () => {
    const req = { file: null, body: {} };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('No file') })
    );
  });

  it('should return 400 if file mimetype is not application/pdf', async () => {
    const req = {
      file: { originalname: 'hack.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('JFIF') },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('PDF') })
    );
  });

  it('should return 400 if magic bytes check fails (spoofed PDF mimetype)', async () => {
    const req = {
      file: {
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('NOTAPDF content here')
      },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should return 400 if PDF has no extractable text (scanned/image PDF)', async () => {
    pdfParse.mockResolvedValue({ text: '' });
    const req = {
      file: {
        originalname: 'scanned.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake content')
      },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No text') })
    );
  });

  it('should embed chunks and return 201 with success fields', async () => {
    const longText = 'This is an academic sentence with enough content. '.repeat(100); // ~5000 chars
    pdfParse.mockResolvedValue({ text: longText });
    const req = {
      file: {
        originalname: 'modul.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 content')
      },
      body: { category: 'modul' }
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(ragService.addDocument).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fileName: 'modul.pdf',
        chunksAdded: expect.any(Number),
        totalChars: expect.any(Number)
      })
    );
    const result = res.json.mock.calls[0][0];
    expect(result.chunksAdded).toBeGreaterThan(0);
  });

  it('should use default category pdf-upload when no category provided', async () => {
    const text = 'Valid text content for embedding purposes only. '.repeat(100);
    pdfParse.mockResolvedValue({ text });
    const req = {
      file: {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 content')
      },
      body: {} // no category
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(ragService.addDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category: 'pdf-upload' })
    );
  });
});
```

- [ ] **Step 5.3: Run tests to see them FAIL**

```bash
cd backend
npm test tests/unit/pdfIngestion.test.js -- --forceExit
```

Expected: All tests FAIL — `uploadPdfDoc is not a function`.

- [ ] **Step 5.4: Add requires, multer instance, and uploadPdfDoc to adminController.js**

At the top of `backend/src/controllers/adminController.js`, after the existing `require` statements, add:

```javascript
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { chunkText } = require('../utils/textChunker');

// Multer — memory storage (no disk writes), 10MB limit.
// MIME type validation is handled inside uploadPdfDoc (single-layer check in controller
// is sufficient; large non-PDF files are buffered up to 10MB before rejection, which is
// acceptable for the trusted admin-only context).
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
```

Then, at the end of `adminController.js`, before `module.exports`, add:

```javascript
/**
 * POST /api/admin/knowledge-base/upload-pdf
 * Upload a PDF file, extract text, chunk it, and embed all chunks into Qdrant.
 */
const uploadPdfDoc = async (req, res) => {
  try {
    // 1. Validate file presence
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Send a PDF as form-data field "file".' });
    }

    // 2. Validate MIME type (layer 1)
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Only PDF files are allowed.' });
    }

    // 3. Validate magic bytes — %PDF (layer 2, prevents spoofed MIME type)
    const magic = req.file.buffer.slice(0, 4).toString();
    if (magic !== '%PDF') {
      return res.status(400).json({ success: false, message: 'File is not a valid PDF (magic bytes check failed).' });
    }

    // 4. Parse PDF text
    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text || '';

    if (rawText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'No text could be extracted from this PDF. It may be a scanned image-only document.'
      });
    }

    // 5. Chunk text and embed
    const fileName = req.file.originalname;
    const category = req.body.category || 'pdf-upload';
    const chunks = chunkText(rawText);

    let chunksAdded = 0;
    for (let i = 0; i < chunks.length; i++) {
      await ragService.addDocument(chunks[i], {
        source: fileName,
        title: fileName,
        category,
        chunk_index: i
      });
      chunksAdded++;
    }

    logger.info(`[ADMIN] PDF ingested: ${fileName} → ${chunksAdded} chunks (${rawText.trim().length} chars)`);

    res.status(201).json({
      success: true,
      fileName,
      chunksAdded,
      totalChars: rawText.trim().length
    });

  } catch (error) {
    logger.error('[ADMIN] uploadPdfDoc error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process PDF.' });
  }
};
```

- [ ] **Step 5.5: Update module.exports in adminController.js**

Find the existing `module.exports` at the bottom of `adminController.js`. It currently looks like:

```javascript
module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics,
    listKnowledgeBase,
    addKnowledgeDoc,
    deleteKnowledgeDoc,
    getBugReports,
    updateBugReport
};
```

Replace with (add `uploadPdfDoc` and `pdfUpload`):

```javascript
module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics,
    listKnowledgeBase,
    addKnowledgeDoc,
    deleteKnowledgeDoc,
    getBugReports,
    updateBugReport,
    uploadPdfDoc,
    pdfUpload
};
```

- [ ] **Step 5.6: Register route in adminRoutes.js**

In `backend/src/routes/adminRoutes.js`, find the destructuring import at line 4:

```javascript
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports, updateBugReport } = require('../controllers/adminController');
```

Replace with:

```javascript
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports, updateBugReport, uploadPdfDoc, pdfUpload } = require('../controllers/adminController');
```

After the existing knowledge-base routes (after `router.delete('/knowledge-base/:id', deleteKnowledgeDoc);`), add:

```javascript
router.post('/knowledge-base/upload-pdf', (req, res, next) => {
  pdfUpload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, uploadPdfDoc);
```

- [ ] **Step 5.7: Run all backend tests**

```bash
cd backend
npm test -- --forceExit
```

Expected: All test suites PASS. The new suites add 7 (textChunker) + 6 (pdfIngestion) = 13 new tests on top of the existing passing tests.

- [ ] **Step 5.8: Commit**

```bash
git add backend/src/controllers/adminController.js backend/src/routes/adminRoutes.js backend/tests/unit/pdfIngestion.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add PDF ingestion endpoint — upload PDF, auto-chunk, embed into Qdrant"
```

---

## Task 6: PDF Upload UI in AdminDashboard

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx` (KnowledgeBaseView component only)

- [ ] **Step 6.1: Add Upload icon to lucide-react imports**

Near the top of `frontend/src/pages/AdminDashboard.jsx`, find the lucide-react import (a multi-line destructure). Add `Upload` to the list of imported icons. For example:

```javascript
// Find the line that has: import { ..., BookOpen, Plus, X, RefreshCw, ... } from 'lucide-react';
// Add Upload to that destructure. The exact list of icons depends on the current file.
// Use grep to confirm the current import: grep -n "from 'lucide-react'" frontend/src/pages/AdminDashboard.jsx
```

This step MUST be done before Steps 6.4 and 6.7 which use `<Upload size={14} />`.

- [ ] **Step 6.2: Add PDF upload state to KnowledgeBaseView**

In `frontend/src/pages/AdminDashboard.jsx`, find the `KnowledgeBaseView` component state declarations:

```javascript
    const [showForm, setShowForm] = useState(false);
```

After the existing state declarations in this component, add:

```javascript
    const [showPdfForm, setShowPdfForm] = useState(false);
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfCategory, setPdfCategory] = useState('');
    const [pdfSubmitting, setPdfSubmitting] = useState(false);
    const [pdfError, setPdfError] = useState('');
    const [pdfSuccess, setPdfSuccess] = useState('');
```

- [ ] **Step 6.3: Add handleUploadPdf function**

After the `handleDelete` function in `KnowledgeBaseView`, add:

```javascript
    const handleUploadPdf = async (e) => {
        e.preventDefault();
        if (!pdfFile) { setPdfError('Please select a PDF file.'); return; }
        if (pdfFile.type !== 'application/pdf') { setPdfError('Only PDF files are allowed.'); return; }
        if (pdfFile.size > 10 * 1024 * 1024) { setPdfError('File too large. Maximum size is 10MB.'); return; }

        try {
            setPdfSubmitting(true);
            setPdfError('');
            setPdfSuccess('');
            const token = localStorage.getItem('token');
            const form = new FormData();
            form.append('file', pdfFile);
            if (pdfCategory.trim()) form.append('category', pdfCategory.trim());

            const res = await axios.post(`${API}/admin/knowledge-base/upload-pdf`, form, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            setPdfSuccess(`✓ ${res.data.fileName} — ${res.data.chunksAdded} chunks embedded`);
            setPdfFile(null);
            setPdfCategory('');
            setShowPdfForm(false);
            await fetchDocs();
        } catch (err) {
            setPdfError(err.response?.data?.message || 'Failed to upload PDF.');
        } finally {
            setPdfSubmitting(false);
        }
    };
```

- [ ] **Step 6.4: Update "Add Document" button to close PDF form when opened**

Find the existing "Add Document" button `onClick`:

```javascript
                        onClick={() => { setShowForm(!showForm); setFormError(''); }}
```

Replace with:

```javascript
                        onClick={() => { setShowForm(!showForm); setShowPdfForm(false); setFormError(''); }}
```

- [ ] **Step 6.5: Add "Upload PDF" button next to "Add Document" button**

After the "Add Document" button, add:

```javascript
                    <button
                        onClick={() => { setShowPdfForm(!showPdfForm); setShowForm(false); setPdfError(''); setPdfSuccess(''); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                    >
                        {showPdfForm ? <X size={14} /> : <Upload size={14} />}
                        {showPdfForm ? 'Cancel' : 'Upload PDF'}
                    </button>
```

- [ ] **Step 6.6: Add PDF upload form panel**

After the existing "Add Document" form block (`{showForm && (...)}`) and before `{/* Error */}`, add:

```javascript
            {/* PDF Upload form */}
            {showPdfForm && (
                <div className="bg-[#18181b] border border-blue-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-1">Upload PDF</h3>
                    <p className="text-xs text-[#71717a] mb-4">Teks akan diekstrak, di-chunk (~1500 karakter), dan di-embed ke Qdrant secara otomatis.</p>
                    <form onSubmit={handleUploadPdf} className="space-y-4">
                        <div>
                            <label className="block text-xs text-[#a1a1aa] mb-1.5">
                                PDF File <span className="text-red-400">*</span>
                                <span className="text-[#71717a] ml-1">(max 10MB, text-layer only)</span>
                            </label>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => { setPdfFile(e.target.files[0] || null); setPdfError(''); }}
                                className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700 focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#a1a1aa] mb-1.5">Category</label>
                            <input
                                type="text"
                                value={pdfCategory}
                                onChange={(e) => setPdfCategory(e.target.value)}
                                placeholder="e.g. modul-kuliah (default: pdf-upload)"
                                className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        {pdfError && <p className="text-red-400 text-xs">{pdfError}</p>}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={pdfSubmitting || !pdfFile}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {pdfSubmitting ? (
                                    <div className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <Upload size={14} />
                                )}
                                {pdfSubmitting ? 'Processing PDF...' : 'Upload & Embed'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
```

- [ ] **Step 6.7: Add PDF success banner**

After the `{error && ...}` block and before the documents table, add:

```javascript
            {/* PDF success banner */}
            {pdfSuccess && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                    <span>{pdfSuccess}</span>
                    <button onClick={() => setPdfSuccess('')} className="ml-auto text-green-300 hover:text-green-100">
                        <X size={14} />
                    </button>
                </div>
            )}
```

- [ ] **Step 6.8: Verify frontend compiles and works**

```bash
cd frontend
npm start
```

Open admin dashboard → Knowledge Base tab. Verify:
- "Upload PDF" button (blue) appears next to "Add Document" (purple)
- Clicking one closes the other
- PDF form shows file input + optional category
- After a successful upload: success banner shows filename + chunk count, KB list refreshes

- [ ] **Step 6.9: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(frontend): add PDF upload form to admin knowledge base panel"
```

---

## Final Verification

- [ ] **Run full backend test suite**

```bash
cd backend
npm test -- --forceExit
```

Expected: All existing tests still PASS, plus 13 new tests (7 textChunker + 6 pdfIngestion).

- [ ] **Manual end-to-end — Markdown**

Ask the AI in chat: *"Tulis fungsi Python untuk hitung IPK dan tampilkan contoh dalam tabel markdown"*

Expected: Code block with Python syntax highlighting + rendered table with borders.

- [ ] **Manual end-to-end — PDF**

1. Admin dashboard → Knowledge Base → Upload PDF → select any text-based PDF
2. Verify success banner: `✓ filename.pdf — N chunks embedded`
3. Ask the AI something related to the PDF content
4. Verify AI answers using content from the uploaded PDF

---

## Summary

| Task | Feature | Key Files |
|------|---------|-----------|
| 1 | Install deps | frontend/package.json |
| 2 | Markdown renderer | ChatMessage.jsx |
| 3 | Fix ragService payload | ragService.js |
| 4 | textChunker util (TDD) | textChunker.js + test |
| 5 | PDF endpoint (TDD) | adminController.js, adminRoutes.js + test |
| 6 | PDF upload UI | AdminDashboard.jsx |
