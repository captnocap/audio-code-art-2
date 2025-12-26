import { useState, useEffect } from 'react'

// Individual buff icon with tooltip
function Buff({ icon, label, active, color = 'violet', hotkey, onClick, pulse = false }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const colorClasses = {
    violet: 'bg-violet-600/80 border-violet-400/50 shadow-violet-500/30',
    green: 'bg-emerald-600/80 border-emerald-400/50 shadow-emerald-500/30',
    blue: 'bg-blue-600/80 border-blue-400/50 shadow-blue-500/30',
    amber: 'bg-amber-600/80 border-amber-400/50 shadow-amber-500/30',
    red: 'bg-red-600/80 border-red-400/50 shadow-red-500/30',
    cyan: 'bg-cyan-600/80 border-cyan-400/50 shadow-cyan-500/30',
  }

  const inactiveClass = 'bg-black/60 border-white/20 shadow-none opacity-50'

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-9 h-9 rounded-lg border backdrop-blur-sm
          flex items-center justify-center
          transition-all duration-200 shadow-lg
          hover:scale-110 active:scale-95
          ${active ? colorClasses[color] : inactiveClass}
          ${pulse && active ? 'animate-pulse' : ''}
        `}
      >
        <span className="text-lg">{icon}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 whitespace-nowrap">
            <div className="text-xs font-medium text-white">{label}</div>
            {hotkey && (
              <div className="text-[10px] text-white/50 mt-0.5">
                Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/70">{hotkey}</kbd> to toggle
              </div>
            )}
            <div className="text-[10px] mt-1 text-white/40">
              {active ? 'Active' : 'Inactive'}
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-l border-t border-white/20 rotate-45" />
        </div>
      )}

      {/* Active indicator dot */}
      {active && (
        <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-green-300`} />
      )}
    </div>
  )
}

// Duration buff with countdown (for future use)
function TimedBuff({ icon, label, duration, onExpire }) {
  const [remaining, setRemaining] = useState(duration)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          onExpire?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [duration, onExpire])

  if (remaining <= 0) return null

  return (
    <div className="relative">
      <div className="w-9 h-9 rounded-lg border border-amber-400/50 bg-amber-600/80 backdrop-blur-sm flex items-center justify-center">
        <span className="text-lg">{icon}</span>
      </div>
      {/* Countdown */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white bg-black/80 px-1 rounded">
        {remaining}s
      </div>
    </div>
  )
}

export default function BuffBar({
  fxEnabled,
  godMode,
  debugEnabled,
  orbitEnabled,
  onToggleFX,
  onToggleGod,
  onToggleDebug,
  onResetCamera
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
      {/* FX Stack */}
      <Buff
        icon="✨"
        label="Post-FX"
        active={fxEnabled}
        color="violet"
        hotkey="F"
        onClick={onToggleFX}
        pulse={fxEnabled}
      />

      {/* God Mode */}
      <Buff
        icon="👁"
        label="God Mode (Orbit Override)"
        active={godMode}
        color="amber"
        hotkey="G"
        onClick={onToggleGod}
      />

      {/* Orbit Controls (read-only indicator when mode enables it) */}
      {orbitEnabled && !godMode && (
        <Buff
          icon="🎯"
          label="Orbit Controls (Mode Default)"
          active={true}
          color="blue"
        />
      )}

      {/* Debug Map */}
      <Buff
        icon="🗺"
        label="Debug Minimap"
        active={debugEnabled}
        color="green"
        hotkey="D"
        onClick={onToggleDebug}
      />

      {/* Reset Camera */}
      <Buff
        icon="↺"
        label="Reset Camera"
        active={false}
        color="cyan"
        hotkey="R"
        onClick={onResetCamera}
      />

      {/* Divider */}
      <div className="w-px h-6 bg-white/20 mx-1" />

      {/* Keyboard hints */}
      <div className="text-[10px] text-white/40 bg-black/40 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
        <span className="text-white/60">Keys:</span> F G D R
      </div>
    </div>
  )
}

export { Buff, TimedBuff }
