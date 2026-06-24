import './../styles/PdfViewer.css'

/** Convert a byte count into a human-friendly string. */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Shows information about the loaded PDF and a scrollable preview of the
 * extracted text.
 *
 * Props:
 *  - pdfName     : string
 *  - pdfMeta     : { pages, size } | null
 *  - pdfText     : string
 *  - isExtracting: boolean
 *  - error       : string
 */
function PdfViewer({ pdfName, pdfMeta, pdfText, isExtracting, error }) {
  const charCount = pdfText.length
  const wordCount = pdfText ? pdfText.trim().split(/\s+/).length : 0

  return (
    <>
      {/* ---- PDF information card ---- */}
      <div className="card">
        <h2 className="card__title">PDF Information</h2>

        {pdfName ? (
          <ul className="info-list">
            <li>
              <span className="info-list__label">Name</span>
              <span className="info-list__value" title={pdfName}>
                {pdfName}
              </span>
            </li>
            <li>
              <span className="info-list__label">Pages</span>
              <span className="info-list__value">
                {pdfMeta?.pages ?? '—'}
              </span>
            </li>
            <li>
              <span className="info-list__label">Size</span>
              <span className="info-list__value">
                {formatSize(pdfMeta?.size)}
              </span>
            </li>
            <li>
              <span className="info-list__label">Words</span>
              <span className="info-list__value">
                {wordCount.toLocaleString()}
              </span>
            </li>
          </ul>
        ) : (
          <p className="muted">No PDF loaded yet.</p>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>

      {/* ---- Extracted text preview ---- */}
      <div className="card card--grow">
        <h2 className="card__title">
          Extracted Text
          {charCount > 0 && (
            <span className="badge">{charCount.toLocaleString()} chars</span>
          )}
        </h2>

        <div className="text-preview">
          {isExtracting ? (
            <div className="text-preview__placeholder">
              <span className="spinner spinner--sm" /> Reading document…
            </div>
          ) : pdfText ? (
            <pre className="text-preview__content">{pdfText}</pre>
          ) : (
            <p className="muted text-preview__placeholder">
              Extracted text will appear here once you upload a PDF.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default PdfViewer
