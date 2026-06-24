import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import PdfUploader from './components/PdfUploader.jsx'
import PdfViewer from './components/PdfViewer.jsx'
import ChatBox from './components/ChatBox.jsx'
import { extractTextFromPdf } from './services/pdfService.js'
import { answerQuestion, summarizePdf } from './services/aiService.js'
import './styles/App.css'

/**
 * Root application component.
 *
 * Owns all top-level state:
 *  - the uploaded PDF file metadata
 *  - the extracted text
 *  - the chat message history
 *  - global UI flags (loading, dark mode, errors)
 *
 * Child components are kept presentational and receive data + callbacks via props.
 */
function App() {
  // --- PDF state -----------------------------------------------------------
  const [pdfName, setPdfName] = useState('')
  const [pdfMeta, setPdfMeta] = useState(null) // { pages, size }
  const [pdfText, setPdfText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)

  // --- Chat state ----------------------------------------------------------
  const [messages, setMessages] = useState([])
  const [isAnswering, setIsAnswering] = useState(false)

  // --- Global UI state -----------------------------------------------------
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    // Respect a previously saved preference, falling back to the OS setting.
    const saved = localStorage.getItem('aipdf-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  // Apply the theme to <html> and persist the choice whenever it changes.
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('aipdf-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  /**
   * Handle a freshly selected PDF file: read it, extract text, store results.
   */
  const handleFileSelected = useCallback(async (file) => {
    setError('')
    setIsExtracting(true)
    setPdfName(file.name)
    setPdfText('')
    setPdfMeta(null)

    try {
      const { text, numPages } = await extractTextFromPdf(file)

      if (!text.trim()) {
        setError(
          'No text could be extracted. This PDF may be scanned images rather than selectable text.'
        )
      }

      setPdfText(text)
      setPdfMeta({ pages: numPages, size: file.size })
    } catch (err) {
      console.error(err)
      setError('Failed to read the PDF. Please try a different file.')
      setPdfName('')
    } finally {
      setIsExtracting(false)
    }
  }, [])

  /**
   * Send a user question through the (simulated) RAG pipeline.
   */
  const handleAskQuestion = useCallback(
    async (question) => {
      const trimmed = question.trim()
      if (!trimmed) return

      // Optimistically push the user's message.
      const userMessage = { id: Date.now(), role: 'user', text: trimmed }
      setMessages((prev) => [...prev, userMessage])
      setIsAnswering(true)

      try {
        const answer = await answerQuestion(trimmed, pdfText)
        const aiMessage = {
          id: Date.now() + 1,
          role: 'ai',
          text: answer,
        }
        setMessages((prev) => [...prev, aiMessage])
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
    [pdfText]
  )

  /**
   * Generate a quick extractive summary of the whole document.
   */
  const handleSummarize = useCallback(async () => {
    if (!pdfText) return
    setIsAnswering(true)

    // Show the intent in the chat so the action is visible.
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: '📄 Summarize this PDF' },
    ])

    try {
      const summary = await summarizePdf(pdfText)
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
          text: 'Sorry — I could not summarize this document.',
        },
      ])
    } finally {
      setIsAnswering(false)
    }
  }, [pdfText])

  /** Remove the loaded PDF and wipe the chat. */
  const handleClearAll = useCallback(() => {
    setPdfName('')
    setPdfMeta(null)
    setPdfText('')
    setMessages([])
    setError('')
  }, [])

  /** Clear only the conversation, keeping the PDF loaded. */
  const handleClearChat = useCallback(() => setMessages([]), [])

  const hasPdf = Boolean(pdfText)

  return (
    <div className="app">
      <Header
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onClearAll={handleClearAll}
        hasContent={hasPdf || messages.length > 0}
      />

      <main className="layout">
        {/* Left panel: upload + info + extracted text */}
        <section className="panel panel--left">
          <PdfUploader
            onFileSelected={handleFileSelected}
            isExtracting={isExtracting}
          />

          <PdfViewer
            pdfName={pdfName}
            pdfMeta={pdfMeta}
            pdfText={pdfText}
            isExtracting={isExtracting}
            error={error}
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
            hasPdf={hasPdf}
          />
        </section>
      </main>
    </div>
  )
}

export default App
