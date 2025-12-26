import { useCallback, useEffect, useRef, useState } from 'react'

export function usePopoutCanvas(sourceCanvasRef) {
    const [isPopoutOpen, setIsPopoutOpen] = useState(false)
    const popoutWindowRef = useRef(null)
    const rafRef = useRef(null)

    const openPopout = useCallback(() => {
        if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
            popoutWindowRef.current.focus()
            return
        }

        const width = 1920
        const height = 1080
        const features = `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`

        const win = window.open('', 'canvas-output', features)
        if (!win) return

        popoutWindowRef.current = win
        setIsPopoutOpen(true)

        // Setup window content
        win.document.title = "Audio Canvas Output"
        win.document.body.style.margin = '0'
        win.document.body.style.background = '#000'
        win.document.body.style.display = 'flex'
        win.document.body.style.alignItems = 'center'
        win.document.body.style.justifyContent = 'center'
        win.document.body.style.height = '100vh'
        win.document.body.style.overflow = 'hidden'

        // Create target canvas
        const canvas = win.document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.style.maxWidth = '100%'
        canvas.style.maxHeight = '100%'
        canvas.style.objectFit = 'contain'
        win.document.body.appendChild(canvas)

        const ctx = canvas.getContext('2d')

        // Copy loop
        const loop = () => {
            if (win.closed) {
                setIsPopoutOpen(false)
                popoutWindowRef.current = null
                return
            }

            // Find source canvas if ref not provided directly (e.g. search DOM)
            const source = sourceCanvasRef?.current || document.querySelector('canvas')

            if (source && ctx) {
                ctx.drawImage(source, 0, 0, width, height)
            }

            rafRef.current = requestAnimationFrame(loop)
        }

        loop()

        // Cleanup on close
        win.addEventListener('beforeunload', () => {
            setIsPopoutOpen(false)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        })

    }, [sourceCanvasRef])

    return { openPopout, isPopoutOpen }
}
