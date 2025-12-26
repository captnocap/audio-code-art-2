import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioStore } from '../../stores/audioStore'
import { useTunerStore } from '../../stores/tunerStore'

/**
 * Renders a Vanilla JS 2D mode onto a full-screen plane in the 3D scene.
 * @param {Object} props
 * @param {Class} props.modeClass - The Vanilla JS mode class to instantiate
 */
export default function VanillaModeWrapper({ modeClass: ModeClass }) {
    const { size, gl } = useThree()
    const canvasRef = useRef(document.createElement('canvas'))
    const modeInstanceRef = useRef(null)
    const textureRef = useRef(null)

    // Get audio data getter
    const getAudioData = useAudioStore(s => s.getAudioData)

    // Tuner data
    const tunerParams = useTunerStore(s => s.params)

    // Initialize mode
    useEffect(() => {
        const canvas = canvasRef.current
        canvas.width = size.width
        canvas.height = size.height
        const ctx = canvas.getContext('2d')

        // Instantiate mode
        const mode = new ModeClass(ctx, size.width, size.height)
        mode.init()
        modeInstanceRef.current = mode

        // Create texture
        const texture = new THREE.CanvasTexture(canvas)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        textureRef.current = texture

        return () => {
            mode.clear()
            texture.dispose()
        }
    }, [ModeClass])

    // Handle resize
    useEffect(() => {
        const canvas = canvasRef.current
        const mode = modeInstanceRef.current
        if (canvas && mode) {
            canvas.width = size.width
            canvas.height = size.height
            mode.resize(size.width, size.height)
            if (textureRef.current) textureRef.current.needsUpdate = true
        }
    }, [size.width, size.height])

    // Update loop
    useFrame(() => {
        const mode = modeInstanceRef.current
        const texture = textureRef.current

        if (mode) {
            // Get FRESH audio data synchronized with this frame
            const audioData = getAudioData()
            const { features, beatInfo } = audioData

            // Update tuner params
            if (tunerParams) {
                mode.tunerParams = tunerParams
            }

            // Update and draw
            mode.update(features, beatInfo)
            mode.draw()

            // Update texture
            if (texture) texture.needsUpdate = true
        }
    })

    // Render full-screen quad with texture
    return (
        <mesh>
            <planeGeometry args={[size.width / 100, size.height / 100]} />
            <FullScreenPlane texture={textureRef.current} />
        </mesh>
    )
}

function FullScreenPlane({ texture }) {
    const { viewport } = useThree()
    return (
        <mesh scale={[viewport.width, viewport.height, 1]}>
            <planeGeometry />
            <meshBasicMaterial map={texture} transparent={true} />
        </mesh>
    )
}
