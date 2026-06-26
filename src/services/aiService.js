// aiService.js
// -----------------------------------------------------------------------------
// "AI" layer for the assistant.
//
// This module simulates a Retrieval-Augmented Generation (RAG) pipeline entirely
// in the browser:
//   1. Split the PDF text into paragraph "chunks".
//   2. Score each chunk against the user's question using keyword overlap
//      (a lightweight TF-style relevance score).
//   3. Return the most relevant paragraphs as the answer.
//
// When an OpenAI API key is configured (VITE_OPENAI_API_KEY), it instead calls
// the GPT Chat Completions API via `axios`, grounded in the retrieved passages.
// -----------------------------------------------------------------------------

import axios from 'axios'

// Common English stop-words to ignore when scoring relevance.
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'as', 'by',
  'that', 'this', 'these', 'those', 'it', 'its', 'from', 'how', 'what', 'why',
  'when', 'where', 'who', 'which', 'do', 'does', 'did', 'can', 'could', 'should',
  'would', 'will', 'i', 'you', 'me', 'my', 'your', 'about', 'into', 'over',
])

/** Lowercase, strip punctuation, split into meaningful tokens. */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

/** Break the document into non-trivial paragraph chunks. */
function splitIntoParagraphs(text) {
  return text
    .split(/\n{2,}|\.\s{2,}/) // blank lines or sentence gaps
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40) // drop tiny fragments / headers
}

/**
 * Score how relevant a paragraph is to the query tokens.
 * Uses term-frequency overlap plus a small bonus for exact phrase matches.
 */
function scoreParagraph(paragraph, queryTokens, rawQuery) {
  const paraTokens = tokenize(paragraph)
  if (paraTokens.length === 0) return 0

  const paraSet = new Set(paraTokens)
  let overlap = 0
  for (const token of queryTokens) {
    if (paraSet.has(token)) overlap += 1
  }

  // Normalise by query length so long paragraphs don't dominate unfairly.
  let score = overlap / Math.max(queryTokens.length, 1)

  // Bonus when the paragraph contains the query as a phrase.
  if (rawQuery.length > 3 && paragraph.toLowerCase().includes(rawQuery)) {
    score += 0.5
  }

  return score
}

/**
 * Simulated RAG retrieval: find the paragraphs most relevant to the question.
 *
 * @param {string} query   - the user's question
 * @param {string} context - the full extracted PDF text
 * @param {number} topK    - how many paragraphs to return
 * @returns {Array<{ text: string, score: number }>}
 */
export function retrieveRelevantChunks(query, context, topK = 3) {
  const queryTokens = tokenize(query)
  const rawQuery = query.toLowerCase().trim()
  const paragraphs = splitIntoParagraphs(context)

  const scored = paragraphs
    .map((text) => ({ text, score: scoreParagraph(text, queryTokens, rawQuery) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK)
}

/**
 * Multi-file retrieval: score paragraphs across every loaded file and return
 * the best ones overall, each tagged with the file it came from (for citations).
 *
 * @param {string} query
 * @param {Array<{ name: string, text: string }>} files
 * @param {number} topK
 * @returns {Array<{ text: string, score: number, source: string }>}
 */
export function retrieveAcrossFiles(query, files, topK = 4) {
  const queryTokens = tokenize(query)
  const rawQuery = query.toLowerCase().trim()

  const scored = []
  for (const file of files) {
    if (!file?.text) continue
    for (const text of splitIntoParagraphs(file.text)) {
      const score = scoreParagraph(text, queryTokens, rawQuery)
      if (score > 0) scored.push({ text, score, source: file.name })
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

/** Combine all files into one labelled text block (for summaries / fallback). */
function combineFilesText(files) {
  return files
    .filter((f) => f?.text)
    .map((f) => `=== ${f.name} ===\n${f.text}`)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// LLM configuration.
//
// Works with any OpenAI-compatible chat API. By default it targets Groq's FREE
// API. You can override the base URL / model via env vars to use OpenAI, etc.
//
// Read from Vite env vars. Anything prefixed with VITE_ is exposed to the
// browser bundle, so it's visible in a deployed site — fine for local use,
// just don't publish a public site with your real key baked in.
// ---------------------------------------------------------------------------
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
// Default to Groq (free); override with VITE_OPENAI_BASE_URL for another provider.
const BASE_URL =
  import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.groq.com/openai/v1'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'llama-3.3-70b-versatile'
const OPENAI_URL = `${BASE_URL}/chat/completions`

/**
 * Ask GPT a question, grounded in the most relevant PDF passages (real RAG).
 *
 * 1. Retrieve the top paragraphs locally (keeps the prompt small & cheap).
 * 2. Send them as context to the OpenAI Chat Completions API via Axios.
 *
 * @param {string} question
 * @param {string} context - full extracted PDF text
 * @returns {Promise<string>} the model's answer
 * @throws if the API key is missing or the request fails
 */
export async function askOpenAI(question, files) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY')
  }

  // Retrieve the most relevant chunks across ALL files (keeps the prompt small).
  const chunks = retrieveAcrossFiles(question, files, 5)

  // Cap how much text we send so we stay within free-tier token limits.
  const MAX_CONTEXT_CHARS = 12000

  let grounding
  if (chunks.length > 0) {
    // We found relevant passages — use them, labelled with their source file.
    grounding = chunks
      .map((c, i) => `[${i + 1}] (from "${c.source}") ${c.text}`)
      .join('\n\n')
  } else {
    // No keyword match (common for "summarize" or broad questions):
    // fall back to the combined document text so the AI has real context.
    grounding = combineFilesText(files).slice(0, MAX_CONTEXT_CHARS)
  }

  // Final safety truncation in case the joined chunks are very large.
  if (grounding.length > MAX_CONTEXT_CHARS) {
    grounding = grounding.slice(0, MAX_CONTEXT_CHARS)
  }

  const systemPrompt =
    'You are a helpful assistant that answers questions about the user\'s ' +
    'uploaded files using the provided document text. Base your answer on that ' +
    'text. When relevant, cite which file the information came from (the file ' +
    'name is given in parentheses before each excerpt). If the answer truly is ' +
    'not present, say so briefly. Use Markdown formatting. Be clear and concise.'

  const userPrompt =
    `Document excerpts:\n${grounding || '(the documents appear to be empty)'}\n\n` +
    `Question: ${question}`

  const { data } = await axios.post(
    OPENAI_URL,
    {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  )

  return data.choices?.[0]?.message?.content?.trim() || 'No answer returned.'
}

/**
 * Produce an answer to a question about the PDF.
 *
 * If an OpenAI API key is configured (VITE_OPENAI_API_KEY), calls GPT directly
 * via Axios. Otherwise falls back to the local keyword-retrieval engine so the
 * app still works with no key.
 *
 * @param {string} question
 * @param {string} context - extracted PDF text
 * @returns {Promise<string>}
 */
export async function answerQuestion(question, files) {
  const loaded = (files ?? []).filter((f) => f?.text?.trim())
  if (loaded.length === 0) {
    return 'Please upload a file first so I have something to read.'
  }

  // ---- Path 1: real GPT answer via Axios (when a key is configured) ----
  if (OPENAI_API_KEY) {
    try {
      return await askOpenAI(question, loaded)
    } catch (err) {
      // Surface useful info, then gracefully fall back to local retrieval.
      const status = err.response?.status
      const apiMsg = err.response?.data?.error?.message
      console.error('OpenAI request failed:', status, apiMsg || err.message)
      // Fall through to local retrieval below.
    }
  }

  // ---- Path 2: local simulated RAG (no key, or API failed) ----
  return new Promise((resolve) => {
    setTimeout(() => {
      const matches = retrieveAcrossFiles(question, loaded, 3)

      if (matches.length === 0) {
        resolve(
          "I couldn't find anything relevant to that in your files. " +
            'Try rephrasing your question or using different keywords.'
        )
        return
      }

      // Cite the source file for each passage (rendered as Markdown).
      const passages = matches
        .map((m, i) => `${i + 1}. *(from **${m.source}**)* ${m.text}`)
        .join('\n\n')
      resolve(`Here's what I found in your files:\n\n${passages}`)
    }, 700) // simulate "thinking" latency
  })
}

/**
 * Generate a lightweight extractive summary of the document.
 * Picks the most "central" paragraphs by keyword density.
 *
 * @param {string} context
 * @returns {Promise<string>}
 */
export function summarizePdf(files) {
  const context = combineFilesText(files ?? [])
  const fileCount = (files ?? []).filter((f) => f?.text?.trim()).length

  return new Promise((resolve) => {
    setTimeout(() => {
      const paragraphs = splitIntoParagraphs(context)
      if (paragraphs.length === 0) {
        resolve('There is not enough text in your files to summarize.')
        return
      }

      // Build a frequency map of meaningful words across the whole document.
      const freq = new Map()
      for (const token of tokenize(context)) {
        freq.set(token, (freq.get(token) || 0) + 1)
      }

      // Score each paragraph by the summed frequency of its words.
      const scored = paragraphs.map((text) => {
        const tokens = tokenize(text)
        const score =
          tokens.reduce((sum, t) => sum + (freq.get(t) || 0), 0) /
          Math.max(tokens.length, 1)
        return { text, score }
      })

      const top = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((p) => `- ${p.text}`)
        .join('\n\n')

      const heading =
        fileCount > 1
          ? `**Summary (key points across ${fileCount} files):**`
          : '**Summary (key points):**'

      resolve(`📌 ${heading}\n\n${top}`)
    }, 800)
  })
}

/**
 * Download the chat history as a plain-text file (bonus feature).
 *
 * @param {Array<{ role: string, text: string }>} messages
 */
export function downloadChatHistory(messages) {
  if (!messages || messages.length === 0) return

  const lines = messages.map((m) => {
    const who = m.role === 'user' ? 'You' : 'AI'
    return `${who}: ${m.text}`
  })

  const header =
    'AI PDF Assistant — Chat History\n' +
    '================================\n\n'
  const blob = new Blob([header + lines.join('\n\n')], {
    type: 'text/plain;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-history.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
