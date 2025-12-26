import { useState } from 'react'
import { useModeStore } from '../stores/modeStore'

export default function ModeStrip() {
  const { currentMode, modes, setMode } = useModeStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const modeList = Object.entries(modes)

  return (
    <div
      className="absolute left-0 top-1/2 -translate-y-1/2 z-40"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          glass-panel rounded-r-xl transition-all duration-300 ease-out
          ${isExpanded ? 'w-48 p-3' : 'w-12 p-2'}
        `}
      >
        <div className="space-y-2">
          {modeList.map(([id, mode]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`
                w-full rounded-lg transition-all duration-200 flex items-center gap-3
                ${currentMode === id
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }
                ${isExpanded ? 'p-2' : 'p-1.5 justify-center'}
              `}
            >
              {/* Mode Icon (placeholder) */}
              <div className={`
                w-6 h-6 rounded-md flex items-center justify-center
                ${currentMode === id ? 'bg-white/20' : 'bg-white/10'}
              `}>
                <span className="text-xs font-bold">
                  {mode.name.charAt(0)}
                </span>
              </div>

              {/* Mode name (shown when expanded) */}
              {isExpanded && (
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{mode.name}</div>
                  <div className="text-xs text-white/50 truncate">{mode.description}</div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Expand indicator */}
        {!isExpanded && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-white/30">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
