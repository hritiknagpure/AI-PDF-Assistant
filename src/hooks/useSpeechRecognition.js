// useSpeechRecognition.js
// -----------------------------------------------------------------------------
// A small React hook around the Web Speech API (SpeechRecognition).
//
// Lets a component dictate text by voice. It exposes the live transcript, a
// listening flag, start/stop controls, and whether the browser supports the API
// at all (Chrome/Edge/Safari do; Firefox does not as of now).
//
// Usage:
//   const { supported, listening, transcript, start, stop, reset, error } =
//     useSpeechRecognition({ lang: 'en-US' })
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'

// The constructor is vendor-prefixed in some browsers.
const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

/**
 * @param {object}  [options]
 * @param {string}  [options.lang='en-US']     recognition language
 * @param {boolean} [options.continuous=false] keep listening after a pause
 * @param {boolean} [options.interimResults=true] emit partial results live
 */
export function useSpeechRecognition({
  lang = 'en-US',
  continuous = false,
  interimResults = true,
} = {}) {
  const supported = Boolean(SpeechRecognitionImpl)

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const recognitionRef = useRef(null)

  // Create the recognition instance once and wire up its event handlers.
  useEffect(() => {
    if (!supported) return

    const recognition = new SpeechRecognitionImpl()
    recognition.lang = lang
    recognition.continuous = continuous
    recognition.interimResults = interimResults

    recognition.onresult = (event) => {
      // Concatenate every result fragment into a single transcript string.
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(text)
    }

    recognition.onerror = (event) => {
      // 'aborted'/'no-speech' are routine; surface the rest.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone access was blocked.'
            : `Voice input error: ${event.error}`
        )
      }
      setListening(false)
    }

    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition

    return () => {
      // Detach handlers and stop on unmount to avoid leaks.
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // Already stopped — ignore.
      }
    }
  }, [supported, lang, continuous, interimResults])

  const start = useCallback(() => {
    if (!supported || listening) return
    setError('')
    setTranscript('')
    try {
      recognitionRef.current?.start()
      setListening(true)
    } catch {
      // start() throws if called while already started; ignore.
    }
  }, [supported, listening])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => setTranscript(''), [])

  return { supported, listening, transcript, error, start, stop, reset }
}

export default useSpeechRecognition
