import React, { useState, useEffect } from 'react'
import { useEdgeProximity } from '../../hooks/useEdgeProximity'
import { useAudioCSS } from '../../hooks/useAudioCSS'
import { useModeStore } from '../../stores/modeStore'
import EdgeStrip from './EdgeStrip'
import Dock from './Dock'
import ModeIcon from './ModeIcon'
import OnboardingTour, { useTour } from './OnboardingTour'

import modeConfig from '../../config/modes.json'

export default function ImmersiveShell({ children }) {
    const edges = useEdgeProximity()
    useAudioCSS()
    const { modes } = useModeStore()
    const { showTour, setShowTour, startTour } = useTour()

    const handleTourComplete = () => {
        setShowTour(false)
    }

    const handleSkip = () => {
        setShowTour(false)
    }

    // Get modes organized by layout position from config
    const getModesByEdge = (edge) => {
        const modeIds = modeConfig.layout[edge]?.modes || []
        return modeIds
            .map(id => ({ id, ...modes[id] }))
            .filter(m => m.name) // Only include modes that exist in store
    }

    const topModes = getModesByEdge('top')
    const leftModes = getModesByEdge('left')
    const rightModes = getModesByEdge('right')

    return (
        <div className="relative w-full h-full overflow-hidden bg-black text-white selection:bg-pink-500/30">
            {/* Canvas Layer (Z-0) */}
            <div className="fixed inset-0 z-0">
                {children}
            </div>

            {/* Tour Overlay (Z-100) */}
            {showTour && <OnboardingTour onComplete={handleTourComplete} onSkip={handleSkip} />}

            {/* UI Layer (Z-10+) */}

            {/* Top: 2D/3D Modes */}
            <EdgeStrip edge="top" visibility={edges.top}>
                {topModes.map(mode => (
                    <ModeIcon
                        key={mode.id}
                        {...mode}
                        color={modeConfig.layout.top.color}
                    />
                ))}
            </EdgeStrip>

            {/* Left: Experimental */}
            <EdgeStrip edge="left" visibility={edges.left}>
                {leftModes.map(mode => (
                    <ModeIcon
                        key={mode.id}
                        {...mode}
                        color={modeConfig.layout.left.color}
                    />
                ))}
            </EdgeStrip>

            {/* Right: Experimental */}
            <EdgeStrip edge="right" visibility={edges.right}>
                {rightModes.map(mode => (
                    <ModeIcon
                        key={mode.id}
                        {...mode}
                        color={modeConfig.layout.right.color}
                        tooltipSide="left"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        }
                    />
                ))}
            </EdgeStrip>

            {/* Bottom: Dock */}
            <Dock visibility={edges.bottom} />
        </div>
    )
}
