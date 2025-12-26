import React, { useState } from 'react'
import { useModeStore } from '../../stores/modeStore'

/**
 * @param {Object} props
 * @param {string} props.id - Mode ID
 * @param {string} props.name - Mode Name
 * @param {string} props.description - Tooltip text
 * @param {string} props.color - Icon/Glow color
 * @param {React.ReactNode} props.icon - SVG Icon
 * @param {string} props.tooltipSide - 'left' or 'right' (default: 'right')
 */
export default function ModeIcon({ id, name, description, color = '#ffffff', icon, tooltipSide = 'right' }) {
    const { currentMode, setMode } = useModeStore()
    const isActive = currentMode === id
    const [isHovered, setIsHovered] = useState(false)

    // Tooltip delay logic could go here, but CSS hover delay is easier for simple cases.
    // For the spec's "200ms delay", we can use a transition-delay on the tooltip opacity.

    return (
        <div className="relative group">
            <button
                onClick={() => setMode(id)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`
          relative w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200
          ${isActive
                        ? 'bg-white/20 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                        : 'bg-black/40 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }
          border
        `}
                style={{
                    boxShadow: isActive ? `0 0 20px ${color}40` : 'none',
                    borderColor: isActive ? `${color}60` : undefined
                }}
            >
                {/* Icon */}
                <div
                    className="w-[60%] h-[60%] transition-colors duration-200"
                    style={{ color: isActive ? color : 'rgba(255,255,255,0.7)' }}
                >
                    {icon || (
                        // Default Icon (Grid)
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                    )}
                </div>
            </button>

            {/* Tooltip */}
            <div
                className={`
                    absolute top-1/2 -translate-y-1/2
                    ${tooltipSide === 'left' ? 'right-full mr-3' : 'left-full ml-3'}
                    px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded text-[10px] text-white whitespace-nowrap z-50
                    transition-opacity duration-200 delay-200 pointer-events-none
                    ${isHovered ? 'opacity-100' : 'opacity-0'}
                `}
            >
                <div className="font-semibold">{name}</div>
                <div className="text-white/50 text-[9px]">{description}</div>
            </div>
        </div>
    )
}
