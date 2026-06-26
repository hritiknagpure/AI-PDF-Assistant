import { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header.jsx'
import PdfUploader from './components/PdfUploader.jsx'
import PdfViewer from './components/PdfViewer.jsx'
import ChatBox from './components/ChatBox.jsx'
import { extractContent } from './services/fileService.js'
import { answerQuestion, summarizePdf } from './services/aiService.js'
import './styles/App.css'

/**
 * Root application component.
 *
 * Owns all top-level state:
 *  - the list of uploaded files (each with extracted text + metadata)
 *  - the chat message history
 *  - global UI flags (loading, dark mode, errors)
 *
 * Child components are kept presentational and receive data + callbacks via props.
 */
function App() {
  // --- Files state ---------------------------------------------------------
  // Each entry: { id, name, kind, size, text, details }
  const [files, setFiles] = useState([])
  const [isExtracting, setIsExtracting] = useState(false)
  const idRef = useRef(0) // monotonically-increasing id for each file

  // --- Chat state ----------------------------------------------------------
  const [messages, setMessages] = useState([])
  const [isAnswering, setIsAnswering] = useState(false)

  // --- Global UI state -----------------------------------------------------
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('aipdf-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('aipdf-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  /**
   * Handle one or more freshly selected files: read each, extract its text,
   * and append it to the list. Files are processed sequentially.
   */
  const handleFilesSelected = useCallback(async (selected) => {
    const list = Array.from(selected ?? [])
    if (list.length === 0) return

    setError('')
    setIsExtracting(true)

    for (const file of list) {
      try {
        const { text, kind, details } = await extractContent(file)
        const id = ++idRef.current
        setFiles((prev) => [
          ...prev,
          { id, name: file.name, kind, size: file.size, text, details },
        ])
        if (!text.trim()) {
          setError(
            kind === 'pdf'
              ? `"${file.name}" has no selectable text (it may be scanned images).`
              : `"${file.name}" appears to be empty.`
          )
        }
      } catch (err) {
        console.error(err)
        setError(`Failed to read "${file.name}". Please try a different file.`)
      }
    }

    setIsExtracting(false)
  }, [])

  /** Remove a single file by id. */
  const handleRemoveFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  /**
   * Send a user question through the (simulated) RAG pipeline across all files.
   */
  const handleAskQuestion = useCallback(
    async (question) => {
      const trimmed = question.trim()
      if (!trimmed) return

      const userMessage = { id: Date.now(), role: 'user', text: trimmed }
      setMessages((prev) => [...prev, userMessage])
      setIsAnswering(true)

      try {
        const answer = await answerQuestion(trimmed, files)
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'ai', text: answer },
        ])
      } catch (err) {
        console.error(err)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'ai',
            text: 'Sorry — something went wrong while generating the answer.',
          },
        ])
      } finally {
        setIsAnswering(false)
      }
    },
    [files]
  )

  /** Generate a quick extractive summary across all loaded files. */
  const handleSummarize = useCallback(async () => {
    if (files.length === 0) return
    setIsAnswering(true)

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: '📄 Summarize my files' },
    ])

    try {
      const summary = await summarizePdf(files)
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', text: summary },
      ])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: 'Sorry — I could not summarize your files.',
        },
      ])
    } finally {
      setIsAnswering(false)
    }
  }, [files])

  /** Remove all files and wipe the chat. */
  const handleClearAll = useCallback(() => {
    setFiles([])
    setMessages([])
    setError('')
  }, [])

  /** Clear only the conversation, keeping files loaded. */
  const handleClearChat = useCallback(() => setMessages([]), [])

  const hasFiles = files.length > 0

  return (
    <div className="app">
      <Header
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onClearAll={handleClearAll}
        hasContent={hasFiles || messages.length > 0}
      />

      <main className="layout">
        {/* Left panel: upload + files + extracted text */}
        <section className="panel panel--left">
          <PdfUploader
            onFilesSelected={handleFilesSelected}
            isExtracting={isExtracting}
          />

          <PdfViewer
            files={files}
            isExtracting={isExtracting}
            error={error}
            onRemoveFile={handleRemoveFile}
          />
        </section>

        {/* Right panel: chat */}
        <section className="panel panel--right">
          <ChatBox
            messages={messages}
            onAsk={handleAskQuestion}
            onSummarize={handleSummarize}
            onClearChat={handleClearChat}
            isAnswering={isAnswering}
            hasPdf={hasFiles}
          />
        </section>
      </main>
    </div>
  )
}

export default App
