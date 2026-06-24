import { useState } from 'react'
import './../styles/Message.css'

/**
 * A single chat bubble.
 *
 * Props:
 *  - role: 'user' | 'ai'
 *  - text: string
 *
 * AI messages get a "Copy" button (bonus feature).
 */
function Message({ role, text }) {
  const [copied, setCopied] = useState(false)
  const isUser = role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      // Revert the label after a short delay.
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
        <p className="message__text">{text}</p>

        {!isUser && (
          <button
            type="button"
            className="message__copy"
            onClick={handleCopy}
            title="Copy answer"
          >
            {copied ? '✅ Copied' : '📋 Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

export default Message
