// useSpeechSynthesis.js
// -----------------------------------------------------------------------------
// A small React hook around the Web Speech API's speechSynthesis (text-to-speech).
//
// Exposes whether TTS is supported, which message is currently speaking, and
// speak/stop controls. Designed so multiple components can share one speaker:
// starting a new utterance cancels any previous one.
//
// Usage:
//   const { supported, speakingId, speak, stop } = useSpeechSynthesis()
//   speak('some-id', 'Hello world')   // start
//   stop()                            // cancel
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'

const synth =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined

export function useSpeechSynthesis({ lang = 'en-US' } = {}) {
  const supported = Boolean(synth)

  // Id of the item currently being spoken (null when idle).
  const [speakingId, setSpeakingId] = useState(null)

  // Cancel any in-flight speech when the component using this unmounts.
  useEffect(() => {
    return () => {
      if (supported) synth.cancel()
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    synth.cancel()
    setSpeakingId(null)
  }, [supported])

  const speak = useCallback(
    (id, text) => {
      if (!supported || !text) return

      // Toggle off if the same item is already speaking.
      if (speakingId === id) {
        stop()
        return
      }

      // Cancel anything currently playing before starting the new utterance.
      synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 1
      utterance.pitch = 1
      utterance.onend = () => setSpeakingId(null)
      utterance.onerror = () => setSpeakingId(null)

      setSpeakingId(id)
      synth.speak(utterance)
    },
    [supported, speakingId, lang, stop]
  )

  return { supported, speakingId, speak, stop }
}

export default useSpeechSynthesis
