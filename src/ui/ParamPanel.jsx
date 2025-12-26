import { useState, useMemo } from 'react'
import { useModeStore } from '../stores/modeStore'
import { useAudioStore } from '../stores/audioStore'
import { expressionEngine } from '../core/ExpressionEngine'

export default function ParamPanel() {
  const getCurrentMode = useModeStore(s => s.getCurrentMode)
  const getCurrentParams = useModeStore(s => s.getCurrentParams)
  const setParamValue = useModeStore(s => s.setParamValue)

  // Get individual audio values
  const bass = useAudioStore(s => s.bass)
  const mid = useAudioStore(s => s.mid)
  const high = useAudioStore(s => s.high)
  const amplitude = useAudioStore(s => s.amplitude)
  const beat = useAudioStore(s => s.beat)
  const time = useAudioStore(s => s.time)

  const [isExpanded, setIsExpanded] = useState(true)

  const mode = getCurrentMode()
  const params = getCurrentParams()

  // Build audio context
  const audioContext = useMemo(() => ({
    bass, mid, high, amplitude, beat, time
  }), [bass, mid, high, amplitude, beat, time])

  if (!mode) return null

  const paramEntries = Object.entries(params)

  return (
    <div className="absolute top-4 right-4 z-40">
      <div className="glass-panel rounded-xl overflow-hidden" style={{ width: isExpanded ? 280 : 48 }}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          {isExpanded && (
            <span className="text-sm font-medium">{mode.name}</span>
          )}
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Parameters */}
        {isExpanded && (
          <div className="p-3 pt-0 space-y-3 max-h-96 overflow-y-auto">
            {paramEntries.map(([name, param]) => (
              <ParamControl
                key={name}
                name={name}
                param={param}
                audioContext={audioContext}
                onChange={(value) => setParamValue(name, value)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ParamControl({ name, param, audioContext, onChange }) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(param.value.toString())

  const isExpression = param.type === 'expression'
  const displayValue = isExpression
    ? expressionEngine.evaluate(param.value, audioContext).toFixed(2)
    : param.value

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isExpression) {
      const error = expressionEngine.validate(inputValue)
      if (!error) {
        onChange(inputValue)
        setIsEditing(false)
      }
    } else {
      const num = parseFloat(inputValue)
      if (!isNaN(num)) {
        onChange(Math.max(param.min, Math.min(param.max, num)))
        setIsEditing(false)
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/60 capitalize">
          {name.replace(/([A-Z])/g, ' $1').trim()}
        </label>
        <span className="text-xs text-violet-400 font-mono">
          {displayValue}
        </span>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:border-violet-500 outline-none"
            autoFocus
            onBlur={() => setIsEditing(false)}
          />
        </form>
      ) : isExpression ? (
        <button
          onClick={() => {
            setInputValue(param.value)
            setIsEditing(true)
          }}
          className="w-full text-left bg-black/30 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white/70 hover:border-violet-500/50 transition-colors truncate"
        >
          {param.value}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={param.value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
          />
          <button
            onClick={() => {
              setInputValue(param.value.toString())
              setIsEditing(true)
            }}
            className="text-xs text-white/40 hover:text-white/60 font-mono w-12 text-right"
          >
            {param.value}
          </button>
        </div>
      )}
    </div>
  )
}
