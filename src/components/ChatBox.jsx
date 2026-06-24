import { useState, useEffect, useRef } from 'react'
import Message from './Message.jsx'
import { downloadChatHistory } from '../services/aiService.js'
import './../styles/ChatBox.css'

/**
 * The conversational interface (right panel).
 *
 * Props:
 *  - messages    : Array<{ id, role, text }>
 *  - onAsk       : (string) => void   submit a question
 *  - onSummarize : () => void         request a document summary
 *  - onClearChat : () => void         wipe the conversation
 *  - isAnswering : boolean            shows the typing/loading state
 *  - hasPdf      : boolean            gates input until a PDF is loaded
 */
function ChatBox({
  messages,
  onAsk,
  onSummarize,
  onClearChat,
  isAnswering,
  hasPdf,
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  // Auto-scroll to the newest message whenever the list or loading state changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isAnswering])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isAnswering || !hasPdf) return
    onAsk(input)
    setInput('')
  }

  // Enter sends, Shift+Enter inserts a newline.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="chat">
      {/* ---- Chat toolbar ---- */}
      <div className="chat__toolbar">
        <h2 className="card__title chat__title">Chat</h2>
        <div className="chat__toolbar-actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onSummarize}
            disabled={!hasPdf || isAnswering}
            title="Summarize the PDF"
          >
            ✨ Summarize
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => downloadChatHistory(messages)}
            disabled={messages.length === 0}
            title="Download chat history"
          >
            ⬇️ Export
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClearChat}
            disabled={messages.length === 0}
            title="Clear chat"
          >
            🧹 Clear
          </button>
        </div>
      </div>

      {/* ---- Messages list ---- */}
      <div className="chat__messages" ref={scrollRef}>
        {messages.length === 0 && !isAnswering && (
          <div className="chat__empty">
            <span className="chat__empty-icon" aria-hidden="true">
              💬
            </span>
            <p>
              {hasPdf
                ? 'Ask anything about your PDF to get started.'
                : 'Upload a PDF on the left to begin chatting.'}
            </p>

            {/* Quick-start suggestion chips (only once a PDF is loaded) */}
            {hasPdf && (
              <div className="chat__suggestions">
                {[
                  'What is this document about?',
                  'Summarize the key points',
                  'List the main topics',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => onAsk(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m) => (
          <Message key={m.id} role={m.role} text={m.text} />
        ))}

        {/* Loading spinner shown while the AI "thinks" */}
        {isAnswering && (
          <div className="message message--ai">
            <div className="message__avatar" aria-hidden="true">
              🤖
            </div>
            <div className="message__bubble message__bubble--loading">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* ---- Input area ---- */}
      <form className="chat__input" onSubmit={handleSubmit}>
        <textarea
          className="chat__textarea"
          placeholder={
            hasPdf ? 'Ask a question about the PDF…' : 'Upload a PDF first…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!hasPdf || isAnswering}
        />
        <button
          type="submit"
          className="btn btn--primary chat__send"
          disabled={!input.trim() || !hasPdf || isAnswering}
        >
          {isAnswering ? <span className="spinner spinner--sm" /> : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default ChatBox
