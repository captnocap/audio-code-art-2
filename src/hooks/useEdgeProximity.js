import { useState, useEffect, useCallback } from 'react'

/**
 * @typedef {'hidden' | 'peek' | 'active'} VisibilityState
 */

/**
 * Manages the visibility state of UI edges based on mouse proximity.
 * 
 * @returns {{
 *   top: VisibilityState,
 *   left: VisibilityState,
 *   right: VisibilityState,
 *   bottom: VisibilityState,
 *   isIdle: boolean
 * }}
 */
export function useEdgeProximity() {
  const [states, setStates] = useState({
    top: 'hidden',
    left: 'hidden',
    right: 'hidden',
    bottom: 'hidden'
  })
  const [isIdle, setIsIdle] = useState(false)
  const [isOverUI, setIsOverUI] = useState(false)

  useEffect(() => {
    let idleTimer

    const handleMouseMove = (e) => {
      const { clientX: x, clientY: y } = e
      const { innerWidth: w, innerHeight: h } = window

      // Check if mouse is over UI elements (prevent idle when interacting)
      const target = e.target
      const isOverUIElement = target.closest('.glass-panel') ||
        target.closest('[class*="bg-black"]') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select')
      setIsOverUI(!!isOverUIElement)

      // Reset idle timer (but give more time when over UI)
      setIsIdle(false)
      clearTimeout(idleTimer)
      const idleDelay = isOverUIElement ? 10000 : 2000 // 10s when over UI, 2s otherwise
      idleTimer = setTimeout(() => {
        setIsIdle(true)
      }, idleDelay)

      // Calculate distances
      const distTop = y
      const distBottom = h - y
      const distLeft = x
      const distRight = w - x

      // Helper to determine state based on distance
      const getState = (dist) => {
        if (dist < 50) return 'active'
        if (dist < 100) return 'peek'
        return 'hidden'
      }

      setStates({
        top: getState(distTop),
        bottom: getState(distBottom),
        left: getState(distLeft),
        right: getState(distRight)
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Initial idle timer
    idleTimer = setTimeout(() => setIsIdle(true), 2000)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(idleTimer)
    }
  }, [])

  // If idle AND not over UI, force all to hidden
  if (isIdle && !isOverUI) {
    return {
      top: 'hidden',
      left: 'hidden',
      right: 'hidden',
      bottom: 'hidden',
      isIdle: true
    }
  }

  return { ...states, isIdle: false }
}
