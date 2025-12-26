import React, { useState } from 'react'

/**
 * Visual Expression Builder for audio-reactive parameters
 * Converts visual selections into expression strings like "0.5 + bass * 1.5"
 */
export default function ExpressionBuilder({ value, onChange }) {
    // Parse existing expression or start fresh
    const [parts, setParts] = useState(parseExpression(value || '0.5'))

    const audioVars = [
        { value: 'bass', label: 'Bass' },
        { value: 'mid', label: 'Mid' },
        { value: 'high', label: 'High' },
        { value: 'amplitude', label: 'Amplitude' },
        { value: 'beat', label: 'Beat' },
        { value: 'beatPulse', label: 'Beat Pulse' },
        { value: 'time', label: 'Time' },
        { value: 'lfo1', label: 'LFO 1' },
        { value: 'lfo2', label: 'LFO 2' },
        { value: 'random', label: 'Random' }
    ]

    const operators = [
        { value: '+', label: '+' },
        { value: '-', label: '−' },
        { value: '*', label: '×' },
        { value: '/', label: '÷' }
    ]

    const updateExpression = (newParts) => {
        setParts(newParts)
        const expr = buildExpression(newParts)
        onChange(expr)
    }

    const addTerm = () => {
        updateExpression([...parts, { operator: '+', variable: 'bass', multiplier: 1 }])
    }

    const removeTerm = (index) => {
        updateExpression(parts.filter((_, i) => i !== index))
    }

    const updatePart = (index, field, value) => {
        const newParts = [...parts]
        newParts[index][field] = value
        updateExpression(newParts)
    }

    return (
        <div className="space-y-2">
            {/* Expression parts */}
            {parts.map((part, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                    {/* Operator (hidden for first term) */}
                    {index > 0 && (
                        <select
                            value={part.operator}
                            onChange={(e) => updatePart(index, 'operator', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-white focus:outline-none focus:border-violet-500"
                        >
                            {operators.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                    )}

                    {/* Base value (if constant) or variable */}
                    {part.variable === 'constant' ? (
                        <input
                            type="number"
                            step="0.1"
                            value={part.constant}
                            onChange={(e) => updatePart(index, 'constant', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-violet-500"
                        />
                    ) : (
                        <>
                            {/* Variable dropdown */}
                            <select
                                value={part.variable}
                                onChange={(e) => updatePart(index, 'variable', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-violet-500"
                            >
                                <option value="constant">Number</option>
                                {audioVars.map(v => (
                                    <option key={v.value} value={v.value}>{v.label}</option>
                                ))}
                            </select>

                            {/* Multiplier */}
                            <span className="text-white/40">×</span>
                            <input
                                type="number"
                                step="0.1"
                                value={part.multiplier}
                                onChange={(e) => updatePart(index, 'multiplier', parseFloat(e.target.value) || 1)}
                                className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-violet-500"
                            />
                        </>
                    )}

                    {/* Remove button */}
                    {parts.length > 1 && (
                        <button
                            onClick={() => removeTerm(index)}
                            className="ml-auto px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                            ×
                        </button>
                    )}
                </div>
            ))}

            {/* Add term button */}
            <button
                onClick={addTerm}
                className="w-full py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/80 transition-colors"
            >
                + Add Term
            </button>

            {/* Preview */}
            <div className="mt-2 p-2 rounded bg-black/40 border border-white/5">
                <div className="text-[9px] text-white/40 uppercase mb-1">Expression</div>
                <code className="text-[11px] text-violet-300 font-mono">{buildExpression(parts)}</code>
            </div>
        </div>
    )
}

// Parse expression string into parts
function parseExpression(expr) {
    // Simple parser for expressions like "0.5 + bass * 1.5"
    // For MVP, just return a default structure
    // You can enhance this later to actually parse the string
    return [
        { operator: '', variable: 'constant', constant: 0.5, multiplier: 1 }
    ]
}

// Build expression string from parts
function buildExpression(parts) {
    return parts.map((part, index) => {
        let term = ''

        if (index > 0) {
            term += ' ' + part.operator + ' '
        }

        if (part.variable === 'constant') {
            term += part.constant
        } else {
            if (part.multiplier !== 1) {
                term += part.multiplier + ' * ' + part.variable
            } else {
                term += part.variable
            }
        }

        return term
    }).join('')
}
