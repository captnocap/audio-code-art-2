import { useState } from 'react'
import { useTunerStore } from '../stores/tunerStore'

export default function TunerPanel() {
  const [isOpen, setIsOpen] = useState(false)

  const decay = useTunerStore(s => s.decay)
  const sensitivity = useTunerStore(s => s.sensitivity)
  const bassWeight = useTunerStore(s => s.bassWeight)
  const midWeight = useTunerStore(s => s.midWeight)
  const highWeight = useTunerStore(s => s.highWeight)
  const setParam = useTunerStore(s => s.setParam)
  const applyPreset = useTunerStore(s => s.applyPreset)

  return (
    <div className="absolute bottom-4 left-4 z-40">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
          isOpen ? 'bg-violet-600' : 'glass-panel hover:bg-white/10'
        }`}
        title="Tuner Panel"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 glass-panel rounded-xl p-4 w-72">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Audio Tuner</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Presets */}
          <div className="flex gap-2 mb-4">
            {['subtle', 'balanced', 'aggressive', 'chaos'].map(preset => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="flex-1 px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 capitalize"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            <SliderParam
              label="Decay"
              value={decay}
              onChange={(v) => setParam('decay', v)}
              tooltip="How fast values fade (higher = smoother)"
            />
            <SliderParam
              label="Sensitivity"
              value={sensitivity}
              onChange={(v) => setParam('sensitivity', v)}
              tooltip="Reactivity threshold (lower = more reactive)"
            />
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/40 mb-2">Frequency Weights</p>
              <SliderParam
                label="Bass"
                value={bassWeight}
                onChange={(v) => setParam('bassWeight', v)}
              />
              <SliderParam
                label="Mid"
                value={midWeight}
                onChange={(v) => setParam('midWeight', v)}
              />
              <SliderParam
                label="High"
                value={highWeight}
                onChange={(v) => setParam('highWeight', v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SliderParam({ label, value, onChange, tooltip }) {
  return (
    <div className="space-y-1" title={tooltip}>
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-violet-400 font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
      />
    </div>
  )
}
