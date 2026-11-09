import { useCallback, useEffect, useRef, useState } from 'react'

/** Seconds of the route played per real second: 1 minute, 5 minutes or 20 minutes. */
export const PLAYBACK_RATES = [
  { rate: 60, label: '1 minuto por segundo' },
  { rate: 300, label: '5 minutos por segundo' },
  { rate: 1200, label: '20 minutos por segundo' },
] as const

export const DEFAULT_RATE = 300

/**
 * A clock that moves through the route from `startMs` to `endMs`. While playing, every animation
 * frame (about 60 per second) advances it by the real time elapsed times the rate. The component
 * that uses it is remounted for each new route, so the clock always starts at the beginning.
 */
export function usePlayback(startMs: number, endMs: number) {
  const [time, setTime] = useState(startMs)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState<number>(DEFAULT_RATE)
  // The animation loop reads the latest time from here, without restarting on every frame.
  const timeRef = useRef(startMs)

  const seek = useCallback(
    (next: number) => {
      timeRef.current = Math.min(endMs, Math.max(startMs, next))
      setTime(timeRef.current)
    },
    [startMs, endMs],
  )

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const elapsed = now - last
      last = now
      seek(timeRef.current + elapsed * rate)
      if (timeRef.current >= endMs) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, rate, endMs, seek])

  const play = useCallback(() => {
    // At the end, playing again starts over.
    if (timeRef.current >= endMs) seek(startMs)
    setPlaying(true)
  }, [endMs, startMs, seek])

  const pause = useCallback(() => setPlaying(false), [])

  return { time, playing, rate, setRate, play, pause, seek }
}
