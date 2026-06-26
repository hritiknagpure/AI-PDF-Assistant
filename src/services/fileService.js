// fileService.js
// -----------------------------------------------------------------------------
// Unified, in-browser file reader. Detects the file type and extracts:
//   - `text`    : a plain-text representation used by the chat / RAG engine
//   - `kind`    : a short type id ('pdf' | 'csv' | 'text' | 'json')
//   - `details` : an array of { label, value } pairs shown in the UI
//
// New formats can be added by registering another handler in EXTRACTORS.
// -----------------------------------------------------------------------------

import { extractTextFromPdf } from './pdfService.js'

/** Max upload size (50 MB) — keeps the browser responsive. */
export const MAX_BYTES = 50 * 1024 * 1024

/**
 * The file types offered in the upload dropdown.
 * `accept` feeds the <input accept="…">; `exts` is used for validation.
 */
export const FILE_TYPES = [
  {
    id: 'all',
    label: 'All supported files',
    accept: '.pdf,.txt,.md,.log,.csv,.json,application/pdf,text/plain,text/csv,application/json',
    exts: ['pdf', 'txt', 'md', 'log', 'csv', 'json'],
    hint: 'PDF, CSV, text, Markdown or JSON',
  },
  {
    id: 'pdf',
    label: 'PDF (.pdf)',
    accept: 'application/pdf,.pdf',
    exts: ['pdf'],
    hint: 'text-based PDFs only',
  },
  {
    id: 'csv',
    label: 'CSV (.csv)',
    accept: 'text/csv,.csv',
    exts: ['csv'],
    hint: 'comma-separated values',
  },
  {
    id: 'text',
    label: 'Text (.txt, .md, .log)',
    accept: 'text/plain,.txt,.md,.log',
    exts: ['txt', 'md', 'log'],
    hint: 'plain text, Markdown or logs',
  },
  {
    id: 'json',
    label: 'JSON (.json)',
    accept: 'application/json,.json',
    exts: ['json'],
    hint: 'structured JSON data',
  },
]

/** Lower-cased file extension without the dot (e.g. "csv"). */
export function getExtension(name = '') {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

/** Human-friendly byte size. */
export function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Read a File as a UTF-8 text string. */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

// ---------------------------------------------------------------------------
// CSV parsing — small RFC-4180-ish parser that handles quoted fields,
// escaped quotes ("") and commas/newlines inside quotes.
// ---------------------------------------------------------------------------
function parseCsv(raw) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++ // skip the escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      // Handle \r\n as a single line break.
      if (ch === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  // Flush the trailing field/row if the file didn't end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------------------------------------------------------------------------
// Per-format extractors. Each returns { text, kind, details }.
// ---------------------------------------------------------------------------

async function extractPdf(file) {
  const { text, numPages } = await extractTextFromPdf(file)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return {
    text,
    kind: 'pdf',
    details: [
      { label: 'Type', value: 'PDF document' },
      { label: 'Pages', value: numPages },
      { label: 'Words', value: words.toLocaleString() },
    ],
  }
}

async function extractCsv(file) {
  const raw = await readFileAsText(file)
  const rows = parseCsv(raw)
  const headers = rows[0] ?? []
  const dataRows = rows.slice(1)

  // Build a readable text form so the chat/RAG has meaningful context:
  // "Header1: value1 | Header2: value2" per record.
  const text = dataRows
    .map((r) =>
      headers.map((h, i) => `${h}: ${r[i] ?? ''}`).join(' | ')
    )
    .join('\n\n')

  return {
    text: text || raw,
    kind: 'csv',
    details: [
      { label: 'Type', value: 'CSV spreadsheet' },
      { label: 'Rows', value: dataRows.length.toLocaleString() },
      { label: 'Columns', value: headers.length },
      {
        label: 'Headers',
        value: headers.length ? headers.join(', ') : '—',
      },
    ],
  }
}

async function extractText(file) {
  const text = await readFileAsText(file)
  const lines = text ? text.split(/\r\n|\r|\n/).length : 0
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const ext = getExtension(file.name)
  return {
    text,
    kind: 'text',
    details: [
      {
        label: 'Type',
        value: ext === 'md' ? 'Markdown' : ext === 'log' ? 'Log file' : 'Plain text',
      },
      { label: 'Lines', value: lines.toLocaleString() },
      { label: 'Words', value: words.toLocaleString() },
    ],
  }
}

async function extractJson(file) {
  const raw = await readFileAsText(file)
  let parsed
  let valid = true
  try {
    parsed = JSON.parse(raw)
  } catch {
    valid = false
  }

  // Pretty-print valid JSON so it's readable in the preview and to the model.
  const text = valid ? JSON.stringify(parsed, null, 2) : raw

  const details = [{ label: 'Type', value: 'JSON data' }]
  if (!valid) {
    details.push({ label: 'Valid', value: '⚠️ malformed JSON' })
  } else if (Array.isArray(parsed)) {
    details.push({ label: 'Shape', value: 'Array' })
    details.push({ label: 'Items', value: parsed.length.toLocaleString() })
  } else if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed)
    details.push({ label: 'Shape', value: 'Object' })
    details.push({ label: 'Keys', value: keys.length })
    details.push({
      label: 'Top-level keys',
      value: keys.slice(0, 8).join(', ') + (keys.length > 8 ? '…' : ''),
    })
  } else {
    details.push({ label: 'Shape', value: typeof parsed })
  }

  return { text, kind: 'json', details }
}

/** Map each extension to its extractor. */
const EXTRACTORS = {
  pdf: extractPdf,
  csv: extractCsv,
  txt: extractText,
  md: extractText,
  log: extractText,
  json: extractJson,
}

/** All extensions this app can read. */
export const SUPPORTED_EXTENSIONS = Object.keys(EXTRACTORS)

/**
 * Extract content from any supported file.
 *
 * @param {File} file
 * @returns {Promise<{ text: string, kind: string, details: Array<{label,value}> }>}
 * @throws {Error} if the type is unsupported or parsing fails
 */
export async function extractContent(file) {
  const ext = getExtension(file.name)
  const extractor = EXTRACTORS[ext]
  if (!extractor) {
    throw new Error(`Unsupported file type: .${ext || 'unknown'}`)
  }
  return extractor(file)
}
