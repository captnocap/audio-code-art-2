import React, { useState, useEffect } from 'react'
import DockPeekBar from './DockPeekBar'
import DockExpanded from './DockExpanded'
import { useUIStore } from '../../stores/uiStore'
import { useModeStore } from '../../stores/modeStore'

export default function Dock({ visibility }) {
    const [isPinned, setIsPinned] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    // UI state from store
    const fxEnabled = useUIStore(s => s.fxEnabled)
    const godMode = useUIStore(s => s.godMode)
    const debugEnabled = useUIStore(s => s.debugEnabled)
    const toggleFX = useUIStore(s => s.toggleFX)
    const toggleGodMode = useUIStore(s => s.toggleGodMode)
    const toggleDebug = useUIStore(s => s.toggleDebug)
    const resetCamera = useUIStore(s => s.resetCamera)

    // Check if mode wants orbit controls
    const getCurrentMode = useModeStore(s => s.getCurrentMode)
    const modeConfig = getCurrentMode()
    const orbitEnabled = godMode || (modeConfig?.orbitControls ?? false)

    // When expanded, force dock to stay visible
    const effectiveVisibility = isPinned || isExpanded ? 'active' : visibility

    // Listen for Escape key to close expanded dock
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isExpanded])

    const transform = effectiveVisibility === 'hidden' ? 'translateY(100%)' : 'translateY(0)'
    const opacity = effectiveVisibility === 'hidden' ? 0 : 1

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-20 transition-all duration-300 ease-out flex flex-col justify-end"
            style={{ transform, opacity }}
        >
            {/* Expanded Content */}
            {isExpanded && (
                <DockExpanded />
            )}

            {/* Peek Bar (Always visible when Dock is active/peek) */}
            <DockPeekBar
                isPinned={isPinned}
                onTogglePin={() => setIsPinned(!isPinned)}
                onExpand={() => setIsExpanded(!isExpanded)}
                fxEnabled={fxEnabled}
                godMode={godMode}
                debugEnabled={debugEnabled}
                orbitEnabled={orbitEnabled}
                onToggleFX={toggleFX}
                onToggleGod={toggleGodMode}
                onToggleDebug={toggleDebug}
                onResetCamera={resetCamera}
            />
        </div>
    )
}
