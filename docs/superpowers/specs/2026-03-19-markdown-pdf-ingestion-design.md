# Markdown Rendering + PDF Ingestion — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Frontend chat UX improvement + Backend knowledge base expansion

---

## Overview

Two independent features that improve the core chat experience and admin knowledge base workflow:

1. **Full Markdown Rendering** — AI responses rendered with full markdown (headings, lists, tables, code blocks with syntax highlighting) instead of bold-only parsing.
2. **PDF Ingestion** — Admin can upload PDF files directly to the knowledge base; backend parses, chunks, and embeds them into Qdrant.

---

## Feature 1: Full Markdown Rendering

### Goal
AI responses currently render only `**bold**` and links. GPT/Claude responses include headings, lists, tables, code blocks — all shown as raw text. This makes responses hard to read for structured content (code, formulas, steps).

### Behavior
- **User messages:** Plain text only. No markdown rendering. Unchanged.
- **Bot messages — during typing animation (`isTyping = true`):** Plain text (current behavior). Prevents flickering from partial markdown syntax mid-animation.
- **Bot messages — after animation completes (`isTyping = false`):** Full markdown via `react-markdown`.
- **Arabic text:** Preserved. Detection runs on the raw content; if Arabic is detected, apply RTL direction via a custom `ReactMarkdown` paragraph component.
- **Code blocks:** Syntax highlighted via `react-syntax-highlighter` (Prism, `oneDark` theme). Language auto-detected from fenced code block annotation (` ```python`, ` ```js`, etc.).

### Libraries
- `react-markdown` — core markdown renderer
- `remark-gfm` — GitHub Flavored Markdown plugin (tables, strikethrough, task lists)
- `react-syntax-highlighter` — code block syntax highlighting

### Component Changes
**Only `frontend/src/components/chat/ChatMessage.jsx` is modified.**

Replace the `formatMessageContent` / `formatMessageWithBold` / `formatMessageWithArabic` helper functions with a single `<MarkdownRenderer content={text} />` internal component that:
- Detects Arabic → wraps paragraphs in RTL div
- Uses `ReactMarkdown` with `remarkGfm` plugin
- Custom `code` component for syntax highlighting (inline vs block)
- Custom `a` component for links (open in new tab, security `rel="noopener noreferrer"`)
- Applied only when `isTyping = false` (bot messages after animation completes)

### Styling
- Code blocks: dark background (`#1e1e2e`), rounded corners, monospace font, horizontal scroll for long lines
- Inline code: light gray background, monospace, slightly smaller font
- Tables: full-width, bordered, alternating row shading
- Headings: appropriately sized, semibold weight
- Lists: proper indentation and bullet/number styling
- All styles scoped to bot message bubble — user messages unaffected

---

## Feature 2: PDF Ingestion

### Goal
Knowledge base currently only accepts manual text input. Admin cannot upload existing documents (modul kuliah, peraturan akademik, panduan, dll). PDF is the most common document format at universities.

### Flow
```
Admin uploads PDF (AdminDashboard)
  → POST /api/admin/knowledge-base/upload-pdf (multipart/form-data)
  → multer (memory storage) — file buffer in memory, no disk write
  → pdf-parse extracts raw text from buffer
  → Chunking: split into ~1500 char chunks with 200 char overlap
  → For each chunk: ragService.addDocument(chunkText, { source: fileName, category })
  → Return: { success, chunksAdded, fileName, totalChars }
```

### Chunking Strategy
- Target chunk size: **1500 characters**
- Overlap: **200 characters** between adjacent chunks (prevents context loss at boundaries)
- Split on sentence boundaries where possible (`.`, `!`, `?` followed by space/newline)
- Minimum chunk size: **100 characters** (skip tiny chunks — page numbers, headers, etc.)
- Each chunk tagged with metadata: `source_file`, `category`, `chunk_index`

### Backend Changes
**Files modified:**
- `backend/src/controllers/adminController.js` — add `uploadPdfDoc` handler
- `backend/src/routes/adminRoutes.js` — register `POST /knowledge-base/upload-pdf` with multer middleware

**New dependency:** `multer` (memory storage)

**Endpoint:** `POST /api/admin/knowledge-base/upload-pdf`
- Auth: admin required (existing `requireAdmin` middleware)
- Content-Type: `multipart/form-data`
- Fields: `file` (PDF, max 10MB), `category` (optional string, default `'pdf-upload'`)
- Validation: file must be `application/pdf`, max 10MB, min text extraction 50 chars
- Response: `{ success, fileName, chunksAdded, totalChars }`
- Error cases: non-PDF file, file too large, PDF has no extractable text (scanned image), parse failure

### Frontend Changes
**Only `frontend/src/pages/AdminDashboard.jsx` (`KnowledgeBaseView` component) is modified.**

Add a second button "Upload PDF" next to the existing "Add Document" button. Clicking it:
1. Opens a small inline form (similar to existing Add Document form) with:
   - File input (`accept="application/pdf"`, max 10MB shown as helper text)
   - Category field (optional, default `pdf-upload`)
   - Upload button
2. During upload: show spinner + "Processing PDF..." text
3. On success: show green banner "✓ {fileName} — {N} chunks embedded"
4. On error: show red error message

The two forms (Add Document / Upload PDF) are mutually exclusive — opening one closes the other.

---

## What Is NOT in Scope

- DOCX, TXT, CSV ingestion — future work
- Scanned PDF (image-only) OCR — `pdf-parse` only handles text-layer PDFs
- Per-chunk visibility in admin table — chunks appear as individual rows with source file name
- PDF preview before upload
- Re-ingestion of existing PDFs

---

## Test Plan

### Markdown Rendering
- [ ] Bot response with `**bold**` renders as bold (not raw asterisks)
- [ ] Bot response with `### heading` renders as heading
- [ ] Bot response with fenced ` ```python` block renders with syntax highlight
- [ ] Bot response with markdown table renders as HTML table
- [ ] User message with `**text**` stays plain (no markdown rendering)
- [ ] Typing animation shows plain text; after animation completes markdown renders
- [ ] Arabic text response has RTL direction

### PDF Ingestion
- [ ] Upload valid PDF → success response with chunk count
- [ ] Upload non-PDF file → 400 error "Only PDF files are allowed"
- [ ] Upload PDF > 10MB → 400 error "File too large"
- [ ] Upload scanned PDF (no text layer) → 400 error "No text could be extracted"
- [ ] Uploaded PDF chunks appear in knowledge base list with source file name
- [ ] Chat query retrieves content from uploaded PDF chunks
