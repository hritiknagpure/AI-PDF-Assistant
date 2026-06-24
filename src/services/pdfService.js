// pdfService.js
// -----------------------------------------------------------------------------
// Browser-side PDF text extraction using pdfjs-dist.
//
// pdf.js needs a "worker" script to parse PDFs off the main thread. With Vite we
// can import the worker as a URL using the `?url` suffix and hand it to pdfjs.
// -----------------------------------------------------------------------------

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Point pdf.js at the bundled worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * Read a File object into an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract all text from a PDF file, page by page, and combine into one string.
 *
 * @param {File} file - the uploaded PDF file
 * @returns {Promise<{ text: string, numPages: number }>}
 * @throws if the file cannot be parsed
 */
export async function extractTextFromPdf(file) {
  const data = await readFileAsArrayBuffer(file)

  // Load the document. `data` is consumed (transferred) by pdf.js.
  const loadingTask = pdfjsLib.getDocument({ data })
  const pdf = await loadingTask.promise

  const pageTexts = []

  // Iterate every page (pages are 1-indexed in pdf.js).
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Each item holds a fragment of text; join them with spaces.
    const strings = content.items.map((item) => item.str)
    pageTexts.push(strings.join(' '))

    // Release page resources as we go.
    page.cleanup()
  }

  // Join pages with double newlines so paragraph splitting stays meaningful.
  const text = pageTexts.join('\n\n')

  return { text, numPages: pdf.numPages }
}
