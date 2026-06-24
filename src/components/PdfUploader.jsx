import { useRef, useState } from 'react'
import './../styles/PdfUploader.css'

/**
 * Drag-and-drop / click PDF uploader.
 *
 * Props:
 *  - onFileSelected: (File) => void  called with a validated PDF File
 *  - isExtracting  : boolean         disables input while busy
 */
function PdfUploader({ onFileSelected, isExtracting }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')

  /** Validate the candidate file before handing it upward. */
  const validateAndSend = (file) => {
    setLocalError('')
    if (!file) return

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      setLocalError('Please upload a .pdf file.')
      return
    }

    // Guard against very large files (50 MB) to keep the browser responsive.
    const MAX_BYTES = 50 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setLocalError('File is too large (max 50 MB).')
      return
    }

    onFileSelected(file)
  }

  const handleInputChange = (e) => {
    validateAndSend(e.target.files?.[0])
    // Reset so selecting the same file again still fires onChange.
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (isExtracting) return
    validateAndSend(e.dataTransfer.files?.[0])
  }

  return (
    <div className="card">
      <h2 className="card__title">Upload PDF</h2>

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
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          hidden
          disabled={isExtracting}
        />

        <span className="dropzone__icon" aria-hidden="true">
          {isExtracting ? '⏳' : '⬆️'}
        </span>
        <p className="dropzone__text">
          {isExtracting
            ? 'Extracting text…'
            : 'Drag & drop a PDF here, or click to browse'}
        </p>
        <p className="dropzone__hint">Max 50 MB · text-based PDFs only</p>
      </div>

      {localError && <p className="form-error">{localError}</p>}
    </div>
  )
}

export default PdfUploader
