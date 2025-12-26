import { useState } from 'react'

export default function AudioInitPrompt({ onInit }) {
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleInit = async (captureMode) => {
    setMode(captureMode)
    setLoading(true)
    setError(null)

    try {
      await onInit(captureMode)
    } catch (err) {
      setError(err.message)
      setLoading(false)
      setMode(null)
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
      <div className="glass-panel rounded-xl p-8 max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          AudioCanvasPro
        </h1>
        <p className="text-white/60 text-center text-sm mb-6">
          Select an audio source to start the visualization
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleInit('tab')}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Capture Tab Audio
            <span className="text-xs text-white/60">(YouTube, Spotify, etc.)</span>
          </button>

          <button
            onClick={() => handleInit('mic')}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Use Microphone
          </button>
        </div>

        {loading && (
          <p className="text-center text-white/60 mt-4 animate-pulse">
            {mode === 'tab' ? 'Select a tab to capture...' : 'Requesting microphone access...'}
          </p>
        )}

        {error && (
          <p className="text-center text-red-400 mt-4 text-sm">
            {error}
          </p>
        )}

        <p className="text-center text-white/40 text-xs mt-6">
          Press H to toggle UI | Drag FX to reorder
        </p>

        {/* Seizure Warning */}
        <div className="mt-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
            <div>
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide">
                Photosensitivity Warning
              </p>
              <p className="text-amber-200/70 text-[11px] mt-1 leading-relaxed">
                This visualizer produces rapid flashing lights, colors, and motion
                that react to audio in real-time. May trigger seizures in people
                with photosensitive epilepsy. Viewer discretion advised.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
