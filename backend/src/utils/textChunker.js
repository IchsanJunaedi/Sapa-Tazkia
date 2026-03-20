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
    if (end >= normalized.length) break; // processed to end of text, stop
    if (start >= normalized.length) break;
    if (start < 0) break;
  }

  return chunks;
}

module.exports = { chunkText };
