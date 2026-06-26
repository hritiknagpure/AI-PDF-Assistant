import { useState, useEffect, useRef } from 'react'
import Message from './Message.jsx'
import { downloadChatHistory } from '../services/aiService.js'
import useSpeechRecognition from '../hooks/useSpeechRecognition.js'
import useSpeechSynthesis from '../hooks/useSpeechSynthesis.js'
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

  // --- Voice input (Web Speech API) --------------------------------------
  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({ lang: 'en-US' })

  // Mirror the live transcript into the textarea while the user dictates.
  useEffect(() => {
    if (listening && transcript) setInput(transcript)
  }, [transcript, listening])

  const toggleVoice = () => {
    if (!hasPdf || isAnswering) return
    if (listening) stopListening()
    else startListening()
  }

  // --- Voice output (text-to-speech) -------------------------------------
  const {
    supported: ttsSupported,
    speakingId,
    speak,
  } = useSpeechSynthesis({ lang: 'en-US' })

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
    if (listening) stopListening()
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
                ? 'Ask anything about your file to get started.'
                : 'Upload a file on the left to begin chatting.'}
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
          <Message
            key={m.id}
            id={m.id}
            role={m.role}
            text={m.text}
            onSpeak={speak}
            isSpeaking={speakingId === m.id}
            ttsSupported={ttsSupported}
          />
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

      {/* Voice input error (e.g. mic blocked) */}
      {voiceError && <p className="chat__voice-error">{voiceError}</p>}

      {/* ---- Input area ---- */}
      <form className="chat__input" onSubmit={handleSubmit}>
        <textarea
          className="chat__textarea"
          placeholder={
            listening
              ? 'Listening… speak now'
              : hasPdf
                ? 'Ask a question about the file…'
                : 'Upload a file first…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!hasPdf || isAnswering}
        />

        {/* Mic button — only rendered when the browser supports the API */}
        {voiceSupported && (
          <button
            type="button"
            className={`btn chat__mic ${listening ? 'chat__mic--active' : 'btn--ghost'}`}
            onClick={toggleVoice}
            disabled={!hasPdf || isAnswering}
            title={listening ? 'Stop voice input' : 'Speak your question'}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={listening}
          >
            {listening ? '⏹️' : '🎤'}
          </button>
        )}

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
