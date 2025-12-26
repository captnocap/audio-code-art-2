import React, { useState } from 'react'
import { usePopoutCanvas } from '../../hooks/usePopoutCanvas'
import { useThree } from '@react-three/fiber'

export default function OutputPanel() {
    const { openPopout, isPopoutOpen } = usePopoutCanvas()
    const [isRecording, setIsRecording] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState(null)

    // Screenshot function
    const handleScreenshot = () => {
        try {
            const canvas = document.querySelector('canvas')
            if (!canvas) return

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `audiocanvas-${Date.now()}.png`
                a.click()
                URL.revokeObjectURL(url)
            })
        } catch (err) {
            console.error('Screenshot failed:', err)
        }
    }

    // Toggle recording
    const toggleRecord = () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorder) {
                mediaRecorder.stop()
            }
        } else {
            // Start recording
            try {
                const canvas = document.querySelector('canvas')
                if (!canvas) return

                const stream = canvas.captureStream(60) // 60 FPS

                // Try codecs in order of preference
                let options
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                    options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 }
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8000000 }
                } else if (MediaRecorder.isTypeSupported('video/webm')) {
                    options = { mimeType: 'video/webm', videoBitsPerSecond: 8000000 }
                } else {
                    options = { videoBitsPerSecond: 8000000 }
                }

                const recorder = new MediaRecorder(stream, options)

                const chunks = []
                recorder.ondataavailable = (e) => chunks.push(e.data)
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `audiocanvas-${Date.now()}.webm`
                    a.click()
                    URL.revokeObjectURL(url)
                    setIsRecording(false)
                    setMediaRecorder(null)
                }

                recorder.start()
                setMediaRecorder(recorder)
                setIsRecording(true)
            } catch (err) {
                console.error('Recording failed:', err)
            }
        }
    }

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 's' || e.key === 'S') {
                if (!e.ctrlKey && !e.metaKey) { // Not Ctrl+S (save page)
                    e.preventDefault()
                    handleScreenshot()
                }
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault()
                toggleRecord()
            }
        }

        window.addEventListener('keydown', handleKeyPress)
        return () => window.removeEventListener('keydown', handleKeyPress)
    }, [isRecording, mediaRecorder])

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Output</h3>

            <div className="space-y-2">
                <button
                    onClick={openPopout}
                    className="w-full flex items-center justify-between px-3 py-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-lg">❐</span>
                        <div className="text-left">
                            <div className="text-[11px] text-white font-medium">Pop-out</div>
                            <div className="text-[9px] text-white/50">Clean Feed</div>
                        </div>
                    </div>
                    {isPopoutOpen && <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>}
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleScreenshot}
                        className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/70 transition-colors"
                    >
                        📸 Shot (S)
                    </button>
                    <button
                        onClick={toggleRecord}
                        className={`px-3 py-2 rounded border text-[10px] transition-colors ${isRecording
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                            }`}
                    >
                        {isRecording ? '⏹ Stop (R)' : '⏺ Rec (R)'}
                    </button>
                </div>
            </div>
        </div>
    )
}
