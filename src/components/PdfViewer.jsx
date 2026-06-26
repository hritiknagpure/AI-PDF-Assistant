import { useEffect, useState } from 'react'
import { formatSize } from '../services/fileService.js'
import './../styles/PdfViewer.css'

/** Small emoji badge per file kind. */
const KIND_ICON = {
  pdf: '📄',
  csv: '📊',
  text: '📝',
  json: '🔧',
}

/**
 * Shows the list of loaded files and a scrollable preview of the selected
 * file's extracted text. Works for any supported format (PDF/CSV/text/JSON).
 *
 * Props:
 *  - files       : Array<{ id, name, kind, size, text, details }>
 *  - isExtracting: boolean
 *  - error       : string
 *  - onRemoveFile: (id) => void
 */
function PdfViewer({ files, isExtracting, error, onRemoveFile }) {
  const [selectedId, setSelectedId] = useState(null)

  // Keep a valid selection: default to the most recently added file.
  useEffect(() => {
    if (files.length === 0) {
      setSelectedId(null)
    } else if (!files.some((f) => f.id === selectedId)) {
      setSelectedId(files[files.length - 1].id)
    }
  }, [files, selectedId])

  const selected = files.find((f) => f.id === selectedId) ?? null
  const charCount = selected?.text.length ?? 0

  return (
    <>
      {/* ---- Files list card ---- */}
      <div className="card">
        <h2 className="card__title">
          Files
          {files.length > 0 && <span className="badge">{files.length}</span>}
        </h2>

        {files.length > 0 ? (
          <ul className="file-list">
            {files.map((f) => (
              <li
                key={f.id}
                className={`file-list__item ${
                  f.id === selectedId ? 'file-list__item--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="file-list__main"
                  onClick={() => setSelectedId(f.id)}
                  title="View extracted content"
                >
                  <span className="file-list__icon" aria-hidden="true">
                    {KIND_ICON[f.kind] ?? '📄'}
                  </span>
                  <span className="file-list__info">
                    <span className="file-list__name" title={f.name}>
                      {f.name}
                    </span>
                    <span className="file-list__meta">
                      {f.details?.[0]?.value ?? f.kind} · {formatSize(f.size)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="file-list__remove"
                  onClick={() => onRemoveFile(f.id)}
                  title={`Remove ${f.name}`}
                  aria-label={`Remove ${f.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {isExtracting ? 'Reading files…' : 'No files loaded yet.'}
          </p>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>

      {/* ---- Selected file details + extracted text ---- */}
      <div className="card card--grow">
        <h2 className="card__title">
          Extracted Content
          {charCount > 0 && (
            <span className="badge">{charCount.toLocaleString()} chars</span>
          )}
        </h2>

        {/* Type-specific details for the selected file */}
        {selected && selected.details?.length > 0 && (
          <div className="detail-chips">
            {selected.details.map((d) => (
              <span className="detail-chip" key={d.label} title={String(d.value)}>
                <span className="detail-chip__label">{d.label}</span>
                <span className="detail-chip__value">{d.value}</span>
              </span>
            ))}
          </div>
        )}

        <div className="text-preview">
          {isExtracting && files.length === 0 ? (
            <div className="text-preview__placeholder">
              <span className="spinner spinner--sm" /> Reading file…
            </div>
          ) : selected?.text ? (
            <pre className="text-preview__content">{selected.text}</pre>
          ) : (
            <p className="muted text-preview__placeholder">
              {selected
                ? 'This file has no extractable text.'
                : 'Extracted content will appear here once you upload a file.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default PdfViewer
