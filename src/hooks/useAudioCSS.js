import { useEffect, useRef } from 'react'
import { useAudioStore } from '../stores/audioStore'

/**
 * Maps audio analysis data to CSS custom properties for reactive UI.
 * Handles smoothing and global toggle.
 */
export function useAudioCSS() {
    const { features, isInitialized } = useAudioStore()
    const rafRef = useRef()

    // Smoothing state
    const smoothed = useRef({
        subBass: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        high: 0,
        energy: 0
    })

    useEffect(() => {
        if (!isInitialized) return

        const update = () => {
            // Get current features (assuming audioStore updates these in real-time)
            // Note: In a real implementation, we might need to subscribe to the analyzer directly
            // if the store doesn't update on every frame to avoid React renders.
            // For now, we'll assume we can access the latest values from the store or a global analyzer.

            // Accessing the raw analyzer data if available would be better for performance
            // than waiting for React state updates. 
            // Let's assume window.audioAnalyzer is available as a fallback or use the store's features.

            const f = useAudioStore.getState().features
            if (!f) return

            // Smoothing factors
            const factors = {
                subBass: 0.88,
                bass: 0.85,
                lowMid: 0.80,
                mid: 0.75,
                highMid: 0.68,
                high: 0.55,
                energy: 0.80
            }

            // Apply smoothing
            const s = smoothed.current
            s.subBass = s.subBass * factors.subBass + (f.bass || 0) * (1 - factors.subBass)
            s.bass = s.bass * factors.bass + (f.bass || 0) * (1 - factors.bass) // Using bass for both if subBass not distinct
            s.lowMid = s.lowMid * factors.lowMid + (f.mid || 0) * (1 - factors.lowMid)
            s.mid = s.mid * factors.mid + (f.mid || 0) * (1 - factors.mid)
            s.highMid = s.highMid * factors.highMid + (f.high || 0) * (1 - factors.highMid)
            s.high = s.high * factors.high + (f.high || 0) * (1 - factors.high)
            s.energy = s.energy * factors.energy + (f.amplitude || 0) * (1 - factors.energy)

            // Update CSS variables
            const r = document.documentElement.style
            r.setProperty('--audio-sub-bass', s.subBass.toFixed(3))
            r.setProperty('--audio-bass', s.bass.toFixed(3))
            r.setProperty('--audio-low-mid', s.lowMid.toFixed(3))
            r.setProperty('--audio-mid', s.mid.toFixed(3))
            r.setProperty('--audio-high-mid', s.highMid.toFixed(3))
            r.setProperty('--audio-high', s.high.toFixed(3))
            r.setProperty('--audio-energy', s.energy.toFixed(3))

            rafRef.current = requestAnimationFrame(update)
        }

        rafRef.current = requestAnimationFrame(update)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [isInitialized])

    // Global toggle for reactivity (can be expanded)
    useEffect(() => {
        document.documentElement.style.setProperty('--audio-reactive', '1')
    }, [])
}
