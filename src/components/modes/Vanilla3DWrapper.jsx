import React, { useRef, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAudioStore } from '../../stores/audioStore'
import { useTunerStore } from '../../stores/tunerStore'

/**
 * Renders a Vanilla JS 3D mode within the R3F scene.
 * Creates a sandbox environment (Group) for the mode to operate in.
 * 
 * @param {Object} props
 * @param {Class} props.modeClass - The Vanilla JS mode class to instantiate
 */
export default function Vanilla3DWrapper({ modeClass: ModeClass }) {
    const { scene, camera, gl, size } = useThree()
    const groupRef = useRef(null)
    const modeInstanceRef = useRef(null)

    // Get audio data getter
    const getAudioData = useAudioStore(s => s.getAudioData)

    // Tuner data
    const tunerParams = useTunerStore(s => s.params)

    useLayoutEffect(() => {
        if (!groupRef.current) return

        // Instantiate mode
        const mode = new ModeClass()
        modeInstanceRef.current = mode

        // Create a proxy scene that redirects add/remove to our group
        const sceneProxy = {
            add: (...args) => {
                args.forEach(obj => {
                    if (obj.isObject3D) groupRef.current.add(obj)
                })
            },
            remove: (...args) => {
                args.forEach(obj => {
                    if (obj.isObject3D) groupRef.current.remove(obj)
                })
            },
            get fog() { return scene.fog },
            set fog(v) { scene.fog = v },
            get background() { return scene.background },
            set background(v) { scene.background = v },
            children: groupRef.current.children
        }

        // Save original scene state
        const originalFog = scene.fog
        const originalBackground = scene.background

        // Initialize mode
        mode.init(sceneProxy, camera, gl)

        return () => {
            // Cleanup
            if (mode.dispose) mode.dispose()

            // Restore scene state
            scene.fog = originalFog
            scene.background = originalBackground

            // Clear group
            if (groupRef.current) {
                groupRef.current.clear()
            }
        }
    }, [ModeClass, scene, camera, gl])

    // Handle resize
    useLayoutEffect(() => {
        const mode = modeInstanceRef.current
        if (mode && mode.resize) {
            mode.resize(size.width, size.height)
        }
    }, [size.width, size.height])

    // Update loop
    useFrame((state, delta) => {
        const mode = modeInstanceRef.current

        if (mode) {
            // Get FRESH audio data synchronized with this frame
            const audioData = getAudioData()
            const { features, beatInfo } = audioData

            // Update tuner params
            if (tunerParams) {
                mode.tunerParams = tunerParams
            }

            // Update mode
            mode.update(features, beatInfo, delta, state.clock.elapsedTime)
        }
    })

    return <group ref={groupRef} />
}
