import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './../styles/Message.css'

/**
 * A single chat bubble.
 *
 * Props:
 *  - id        : message id (used by the shared speaker)
 *  - role      : 'user' | 'ai'
 *  - text      : string
 *  - onSpeak   : (id, text) => void   read the message aloud (AI only)
 *  - isSpeaking: boolean              whether THIS message is being spoken
 *  - ttsSupported: boolean            hides the speak button if unsupported
 *
 * AI messages render Markdown and get "Copy" + "Speak" buttons.
 */
function Message({ id, role, text, onSpeak, isSpeaking, ttsSupported }) {
  const [copied, setCopied] = useState(false)
  const isUser = role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API may be unavailable (e.g. insecure context); fail silently.
    }
  }

  return (
    <div className={`message ${isUser ? 'message--user' : 'message--ai'}`}>
      <div className="message__avatar" aria-hidden="true">
        {isUser ? '🧑' : '🤖'}
      </div>

      <div className="message__bubble">
        {isUser ? (
          // User input stays plain text (preserve line breaks).
          <p className="message__text">{text}</p>
        ) : (
          // AI answers render as Markdown (lists, bold, code, tables, links).
          <div className="message__text message__markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Open any links in a new tab safely.
                a: ({ node, ...props }) => (
                  <a target="_blank" rel="noopener noreferrer" {...props} />
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && (
          <div className="message__actions">
            <button
              type="button"
              className="message__action"
              onClick={handleCopy}
              title="Copy answer"
            >
              {copied ? '✅ Copied' : '📋 Copy'}
            </button>

            {ttsSupported && (
              <button
                type="button"
                className={`message__action ${
                  isSpeaking ? 'message__action--active' : ''
                }`}
                onClick={() => onSpeak(id, text)}
                title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                aria-pressed={isSpeaking}
              >
                {isSpeaking ? '⏹️ Stop' : '🔊 Speak'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message
