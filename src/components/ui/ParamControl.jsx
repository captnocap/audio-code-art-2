import React, { useState } from 'react'
import ExpressionBuilder from './ExpressionBuilder'

/**
 * @param {Object} props
 * @param {Object} props.param - Parameter definition
 * @param {any} props.value - Current value
 * @param {Function} props.onChange - Change handler
 */
export default function ParamControl({ param, value, onChange }) {
    const { type, label, min, max, step, options, hint, default: def } = param
    const [showBuilder, setShowBuilder] = useState(false)

    const Label = () => (
        <div className="flex items-center gap-2 mb-1">
            <div className="text-[11px] text-white/85 leading-tight">{label}</div>
            {hint && (
                <span className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] text-white/75 border border-white/10">?</span>
            )}
        </div>
    )

    if (type === 'bool' || type === 'boolean') {
        return (
            <div className="py-2">
                <div className="flex items-center justify-between gap-3">
                    <Label />
                    <button
                        className={`
              h-5 w-9 rounded-full border transition-colors relative
              ${value ? 'bg-white/20 border-white/30' : 'bg-black/30 border-white/10'}
            `}
                        onClick={() => onChange(!value)}
                    >
                        <div
                            className={`
                absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white/80 transition-transform
                ${value ? 'translate-x-4' : 'translate-x-0'}
              `}
                        />
                    </button>
                </div>
            </div>
        )
    }

    if (type === 'color') {
        return (
            <div className="py-2">
                <div className="flex items-center justify-between gap-3">
                    <Label />
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={value || '#000000'}
                            onChange={(e) => onChange(e.target.value)}
                            className="h-6 w-8 rounded bg-transparent cursor-pointer border-none p-0"
                        />
                        <code className="text-[10px] text-white/55 font-mono">{value}</code>
                    </div>
                </div>
            </div>
        )
    }

    if (type === 'enum' || (options && options.length > 0)) {
        return (
            <div className="py-2">
                <div className="flex items-center justify-between gap-3">
                    <Label />
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-6 rounded bg-black/30 border border-white/10 text-[11px] text-white/80 px-2 outline-none focus:border-white/30"
                    >
                        {options.map((opt) => (
                            <option key={opt} value={opt} className="bg-black text-white">
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        )
    }

    if (type === 'expression') {
        return (
            <div className="py-2 space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <Label />
                    <button
                        onClick={() => setShowBuilder(!showBuilder)}
                        className="text-[9px] text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        {showBuilder ? '[ Manual ]' : '[ Builder ]'}
                    </button>
                </div>
                {showBuilder ? (
                    <ExpressionBuilder value={value} onChange={onChange} />
                ) : (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white/90 outline-none focus:border-white/30"
                        placeholder={def}
                    />
                )}
            </div>
        )
    }

    // Default: Number/Float Slider
    const numValue = Number(value)
    const safeValue = isNaN(numValue) ? (def || 0) : numValue
    const rangeMin = min ?? 0
    const rangeMax = max ?? 1
    const rangeStep = step ?? 0.01

    return (
        <div className="py-2">
            <div className="flex items-center justify-between gap-3">
                <Label />
                <code className="text-[10px] text-white/60 font-mono">{safeValue.toFixed(2)}</code>
            </div>
            <div className="relative h-4 flex items-center">
                <input
                    type="range"
                    min={rangeMin}
                    max={rangeMax}
                    step={rangeStep}
                    value={safeValue}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/80"
                />
            </div>
        </div>
    )
}
