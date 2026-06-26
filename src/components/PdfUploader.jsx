import { useRef, useState } from 'react'
import {
  FILE_TYPES,
  MAX_BYTES,
  getExtension,
  formatSize,
} from '../services/fileService.js'
import './../styles/PdfUploader.css'

/**
 * Drag-and-drop / click file uploader with a file-type dropdown.
 *
 * Supports PDF, CSV, text (.txt/.md/.log) and JSON. The dropdown narrows which
 * type is accepted; "All supported files" accepts any of them.
 *
 * Props:
 *  - onFilesSelected: (File[]) => void  called with the validated files
 *  - isExtracting   : boolean           disables input while busy
 */
function PdfUploader({ onFilesSelected, isExtracting }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')
  const [typeId, setTypeId] = useState('all')

  const activeType = FILE_TYPES.find((t) => t.id === typeId) ?? FILE_TYPES[0]

  /**
   * Validate a list of candidate files against the selected type, then send the
   * valid ones up. Invalid ones are collected into a single error message.
   */
  const validateAndSend = (fileList) => {
    setLocalError('')
    const candidates = Array.from(fileList ?? [])
    if (candidates.length === 0) return

    const valid = []
    const rejected = []

    for (const file of candidates) {
      const ext = getExtension(file.name)
      if (!activeType.exts.includes(ext)) {
        rejected.push(`${file.name} (wrong type)`)
      } else if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} (too large)`)
      } else {
        valid.push(file)
      }
    }

    if (rejected.length > 0) {
      setLocalError(`Skipped: ${rejected.join(', ')}.`)
    }
    if (valid.length > 0) {
      onFilesSelected(valid)
    }
  }

  const handleInputChange = (e) => {
    validateAndSend(e.target.files)
    // Reset so selecting the same file again still fires onChange.
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (isExtracting) return
    validateAndSend(e.dataTransfer.files)
  }

  return (
    <div className="card">
      <h2 className="card__title">Upload File</h2>

      {/* ---- File-type selector ---- */}
      <label className="uploader__type">
        <span className="uploader__type-label">File type</span>
        <select
          className="uploader__select"
          value={typeId}
          onChange={(e) => {
            setTypeId(e.target.value)
            setLocalError('')
          }}
          disabled={isExtracting}
        >
          {FILE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${
          isExtracting ? 'dropzone--disabled' : ''
        }`}
        onClick={() => !isExtracting && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!isExtracting) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isExtracting) {
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={activeType.accept}
          onChange={handleInputChange}
          multiple
          hidden
          disabled={isExtracting}
        />

        <span className="dropzone__icon" aria-hidden="true">
          {isExtracting ? '⏳' : '⬆️'}
        </span>
        <p className="dropzone__text">
          {isExtracting
            ? 'Reading files…'
            : 'Drag & drop files here, or click to browse'}
        </p>
        <p className="dropzone__hint">
          Max {formatSize(MAX_BYTES)} · {activeType.hint}
        </p>
      </div>

      {localError && <p className="form-error">{localError}</p>}
    </div>
  )
}

export default PdfUploader
