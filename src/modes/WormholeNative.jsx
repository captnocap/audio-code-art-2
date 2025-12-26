import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioStore } from '../stores/audioStore'

export default function WormholeNativeMode({ audioContext, visualTime, isRecording }) {
    const { camera } = useThree()

    const segments = 64
    const rings = 150
    const ringSpacing = 1.5
    const baseRadius = 15
    const maxDisplacement = 12
    const maxParticles = 500
    const trailLength = 8

    const groupRef = useRef()
    const meshRef = useRef()
    const wireframeRef = useRef()
    const particleMeshRef = useRef()
    const playerRef = useRef()
    const playerTrailRef = useRef()
    const centerLightRef = useRef()

    const heightMap = useRef([])
    const paintLayer = useRef([])
    const particles = useRef([])
    const frequencyMapping = useRef(null)
    const reverseMapping = useRef(null)
    const mappingMorphTargets = useRef(null)
    const mappingCurrentPos = useRef(null)

    const smoothedAudio = useRef({ bass: 0, mid: 0, high: 0, amplitude: 0 })
    const scrollOffset = useRef(0)
    const tunnelRotation = useRef(0)
    const cameraRotation = useRef(0)
    const recentMax = useRef(0.3)
    const playerAngle = useRef(Math.PI / 2)
    const playerTrailIntensity = useRef(0)
    const keys = useRef({ left: false, right: false })

    const isDropping = useRef(false)
    const dropTimer = useRef(0)
    const frozenParticleVelocities = useRef(null)

    const initFrequencyMapping = () => {
        frequencyMapping.current = new Array(segments)
        reverseMapping.current = new Array(segments)
        mappingMorphTargets.current = new Array(segments)
        mappingCurrentPos.current = new Float32Array(segments)

        const indices = []
        for (let i = 0; i < segments; i++) indices.push(i)

        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]]
        }

        for (let i = 0; i < segments; i++) {
            frequencyMapping.current[i] = indices[i]
            reverseMapping.current[indices[i]] = i
            mappingCurrentPos.current[i] = indices[i]
            mappingMorphTargets.current[i] = indices[i]
        }
    }

    const reshuffleMapping = () => {
        const newIndices = []
        for (let i = 0; i < segments; i++) newIndices.push(i)

        for (let i = newIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newIndices[i], newIndices[j]] = [newIndices[j], newIndices[i]]
        }

        for (let i = 0; i < segments; i++) {
            mappingMorphTargets.current[i] = newIndices[i]
        }
    }

    useEffect(() => {
        heightMap.current = []
        paintLayer.current = []
        for (let r = 0; r < rings; r++) {
            heightMap.current.push(new Float32Array(segments))
            paintLayer.current.push([])
            for (let s = 0; s < segments; s++) {
                paintLayer.current[r].push({ r: 0, g: 0, b: 0, intensity: 0 })
            }
        }

        initFrequencyMapping()

        const tunnelLength = rings * ringSpacing
        particles.current = []
        for (let i = 0; i < maxParticles; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = 3 + Math.random() * (baseRadius - 5)
            const z = -Math.random() * tunnelLength

            particles.current.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                z: z,
                vz: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40),
                angle: angle,
                radius: radius,
                hue: Math.random(),
                size: 0.5 + Math.random() * 1.5,
                trail: []
            })
        }
    }, [])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
            if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
            if (e.key === 'r' || e.key === 'R') reshuffleMapping()
        }
        const handleKeyUp = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false
            if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    const tunnelGeometry = useMemo(() => {
        const vertexCount = rings * segments
        const positions = new Float32Array(vertexCount * 3)
        const colors = new Float32Array(vertexCount * 3)
        const indices = []

        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < segments; s++) {
                const idx = (r * segments + s) * 3
                const angle = (s / segments) * Math.PI * 2

                positions[idx] = Math.cos(angle) * baseRadius
                positions[idx + 1] = Math.sin(angle) * baseRadius
                positions[idx + 2] = -r * ringSpacing

                colors[idx] = 0.2
                colors[idx + 1] = 0.5
                colors[idx + 2] = 0.8
            }
        }

        for (let r = 0; r < rings - 1; r++) {
            for (let s = 0; s < segments; s++) {
                const current = r * segments + s
                const next = r * segments + ((s + 1) % segments)
                const currentNext = (r + 1) * segments + s
                const nextNext = (r + 1) * segments + ((s + 1) % segments)

                indices.push(current, next, currentNext)
                indices.push(next, nextNext, currentNext)
            }
        }

        const geometry = new THREE.BufferGeometry()
        const posAttr = new THREE.BufferAttribute(positions, 3)
        posAttr.setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('position', posAttr)

        const colAttr = new THREE.BufferAttribute(colors, 3)
        colAttr.setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('color', colAttr)

        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        return geometry
    }, [])

    const particleGeometry = useMemo(() => {
        const totalPoints = maxParticles * trailLength
        const positions = new Float32Array(totalPoints * 3)
        const colors = new Float32Array(totalPoints * 3)
        const sizes = new Float32Array(totalPoints)

        const geometry = new THREE.BufferGeometry()

        const posAttr = new THREE.BufferAttribute(positions, 3)
        posAttr.setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('position', posAttr)

        const colAttr = new THREE.BufferAttribute(colors, 3)
        colAttr.setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('color', colAttr)

        const sizeAttr = new THREE.BufferAttribute(sizes, 1)
        sizeAttr.setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('size', sizeAttr)

        return geometry
    }, [])

    const solidMaterial = useMemo(() => new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        flatShading: false,
        shininess: 80
    }), [])

    const wireMaterial = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    }), [])

    const particleMaterial = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            pointSize: { value: 3.0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            varying float vAlpha;
            uniform float pointSize;

            void main() {
                vColor = color;
                vAlpha = color.r;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * pointSize * (200.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.0, dist) * vAlpha * 0.3;
                gl_FragColor = vec4(vColor * 0.6, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }), [])

    const playerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: 0xff00cc,
        emissive: 0xaa0044,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.8
    }), [])

    const playerTrailMaterial = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    }), [])

    const playerGeometry = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.5, 2, 4)
        geo.rotateX(Math.PI / 2)
        return geo
    }, [])

    const playerTrailGeometry = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.3, 4, 4)
        geo.rotateX(-Math.PI / 2)
        return geo
    }, [])

    useFrame((state, delta) => {
        const freshAudio = useAudioStore.getState().getAudioData()
        const { bass, mid, high, amplitude, beat, beatPulse } = freshAudio
        const frequencies = freshAudio.features.frequencies
        const centroid = freshAudio.features.centroid || 0.5
        const onBeat = freshAudio.beatInfo.onBeat
        const beatIntensity = freshAudio.beatInfo.beatIntensity

        const smoothing = 0.15
        smoothedAudio.current.bass += (bass - smoothedAudio.current.bass) * smoothing
        smoothedAudio.current.mid += (mid - smoothedAudio.current.mid) * smoothing
        smoothedAudio.current.high += (high - smoothedAudio.current.high) * smoothing
        smoothedAudio.current.amplitude += (amplitude - smoothedAudio.current.amplitude) * smoothing

        const { bass: sBass, mid: sMid, high: sHigh, amplitude: sAmp } = smoothedAudio.current

        const timeToUse = visualTime !== undefined ? visualTime : state.clock.elapsedTime
        const deltaToUse = isRecording ? Math.min(delta, 0.05) : delta

        if (!isDropping.current) {
            const scrollSpeed = 30 + sAmp * 40
            scrollOffset.current += scrollSpeed * deltaToUse
        }

        if (scrollOffset.current >= ringSpacing) {
            scrollOffset.current -= ringSpacing

            for (let r = 0; r < rings - 1; r++) {
                heightMap.current[r] = heightMap.current[r + 1]
                paintLayer.current[r] = paintLayer.current[r + 1]
            }

            heightMap.current[rings - 1] = new Float32Array(segments)
            paintLayer.current[rings - 1] = []
            for (let s = 0; s < segments; s++) {
                paintLayer.current[rings - 1].push({ r: 0, g: 0, b: 0, intensity: 0 })
            }
        }

        if (!isDropping.current) {
            tunnelRotation.current += deltaToUse * (0.3 + sAmp * 0.5)
        }

        if (frequencyMapping.current) {
            const morphSpeed = 0.1 * deltaToUse
            for (let i = 0; i < segments; i++) {
                const target = mappingMorphTargets.current[i]
                const current = mappingCurrentPos.current[i]
                let diff = target - current
                if (Math.abs(diff) > segments / 2) {
                    diff = diff > 0 ? diff - segments : diff + segments
                }
                mappingCurrentPos.current[i] += diff * morphSpeed
                if (mappingCurrentPos.current[i] < 0) mappingCurrentPos.current[i] += segments
                if (mappingCurrentPos.current[i] >= segments) mappingCurrentPos.current[i] -= segments
                frequencyMapping.current[i] = Math.round(mappingCurrentPos.current[i]) % segments
            }
            for (let i = 0; i < segments; i++) {
                reverseMapping.current[frequencyMapping.current[i]] = i
            }
            if (beatIntensity > 0.8 && Math.random() < 0.1) {
                reshuffleMapping()
            }
        }

        if (onBeat && beatIntensity > 0.85 && !isDropping.current && sBass > 0.7) {
            isDropping.current = true
            dropTimer.current = 0
            frozenParticleVelocities.current = particles.current.map(p => p.vz)
            for (const p of particles.current) p.vz = 0
            solidMaterial.side = THREE.DoubleSide
            wireMaterial.opacity = 0.8
        }

        if (isDropping.current) {
            dropTimer.current += deltaToUse
            solidMaterial.opacity = 0.3 + Math.random() * 0.4
            solidMaterial.transparent = true
            wireMaterial.color.setHSL(Math.random(), 1, 0.8)

            if (dropTimer.current > 0.5) {
                isDropping.current = false
                if (frozenParticleVelocities.current) {
                    particles.current.forEach((p, i) => {
                        p.vz = frozenParticleVelocities.current[i] * 2
                    })
                    frozenParticleVelocities.current = null
                }
                solidMaterial.side = THREE.BackSide
                solidMaterial.opacity = 1
                solidMaterial.transparent = false
                wireMaterial.opacity = 0.2
            }
        }

        if (playerRef.current) {
            const rotateSpeed = deltaToUse * 3.5
            if (keys.current.left) playerAngle.current -= rotateSpeed
            if (keys.current.right) playerAngle.current += rotateSpeed

            const playerZ = 2
            const playerRingIdx = Math.floor(Math.abs(playerZ) / ringSpacing) + 2
            const normalizedAngle = ((playerAngle.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
            const segmentIdx = Math.floor((normalizedAngle / (Math.PI * 2)) * segments)

            const terrainHeight = (heightMap.current[playerRingIdx]?.[segmentIdx]) || 0
            const hoverDist = 1.5
            const playerRadius = baseRadius - terrainHeight - hoverDist

            playerRef.current.position.x = Math.cos(playerAngle.current) * playerRadius
            playerRef.current.position.y = Math.sin(playerAngle.current) * playerRadius
            playerRef.current.position.z = playerZ
            playerRef.current.rotation.z = playerAngle.current - (Math.PI / 2)

            let bankAngle = 0
            if (keys.current.left) bankAngle = 0.4
            if (keys.current.right) bankAngle = -0.4
            playerRef.current.rotation.x = bankAngle

            playerTrailIntensity.current = 0.3 + sAmp * 0.5
            if (playerTrailRef.current) {
                playerTrailRef.current.material.opacity = playerTrailIntensity.current
                playerTrailRef.current.scale.z = 1 + sBass * 2
            }

            if (playerMaterial.emissive) {
                playerMaterial.emissiveIntensity = 0.5 + sAmp * 1.5
                playerMaterial.emissive.setHSL(centroid * 0.5 + 0.8, 1, 0.5)
            }

            if (paintLayer.current[playerRingIdx]?.[segmentIdx]) {
                const paint = paintLayer.current[playerRingIdx][segmentIdx]
                paint.r = 1
                paint.g = 0.2
                paint.b = 0.8
                paint.intensity = Math.min(2.0, paint.intensity + 0.5)
            }
        }

        let frameMax = 0
        if (frequencies) {
            for (let i = 0; i < frequencies.length; i++) {
                frameMax = Math.max(frameMax, frequencies[i] / 255)
            }
        }
        recentMax.current = recentMax.current * 0.99 + frameMax * 0.01
        recentMax.current = Math.max(0.1, recentMax.current)

        const backRing = rings - 1
        if (frequencies && frequencies.length > 0) {
            const binCount = Math.min(frequencies.length, 256)

            for (let s = 0; s < segments; s++) {
                const visualPos = frequencyMapping.current ? frequencyMapping.current[s] : s
                const normalizedS = s / segments
                const binIndex = Math.floor(normalizedS * binCount)

                if (binIndex < frequencies.length && heightMap.current[backRing]) {
                    const rawMag = frequencies[binIndex] / 255
                    const normalizedMag = Math.min(1, rawMag / recentMax.current)
                    const displacement = normalizedMag * maxDisplacement * (0.8 + sBass * 0.4)
                    const visualPos = frequencyMapping.current ? frequencyMapping.current[s] : s
                    const existing = heightMap.current[backRing][visualPos] || 0
                    heightMap.current[backRing][visualPos] = existing * 0.2 + displacement * 0.8
                }
            }
        }

        const positions = tunnelGeometry.attributes.position.array
        const colors = tunnelGeometry.attributes.color.array

        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < segments; s++) {
                const idx = (r * segments + s) * 3
                const angle = (s / segments) * Math.PI * 2 + tunnelRotation.current
                const displacement = (heightMap.current[r] && heightMap.current[r][s]) ? heightMap.current[r][s] : 0
                const radius = baseRadius - displacement

                positions[idx] = Math.cos(angle) * radius
                positions[idx + 1] = Math.sin(angle) * radius
                positions[idx + 2] = -r * ringSpacing

                const normalizedDisp = displacement / maxDisplacement
                const depthFade = 1 - (r / rings) * 0.4

                let hue, saturation, lightness
                if (normalizedDisp < 0.3) {
                    hue = 0.7 - normalizedDisp * 0.3
                    saturation = 0.8
                    lightness = 0.1 + normalizedDisp * 0.3
                } else if (normalizedDisp < 0.6) {
                    hue = 0.5 - (normalizedDisp - 0.3) * 0.5
                    saturation = 0.9
                    lightness = 0.3 + normalizedDisp * 0.3
                } else {
                    hue = 0.15 - (normalizedDisp - 0.6) * 0.3
                    saturation = 1 - (normalizedDisp - 0.6) * 0.5
                    lightness = 0.5 + normalizedDisp * 0.4
                }

                const color = new THREE.Color()
                color.setHSL(hue, saturation, lightness * depthFade)

                if (normalizedDisp > 0.7) {
                    color.r = Math.min(1, color.r * 1.3)
                    color.g = Math.min(1, color.g * 1.2)
                    color.b = Math.min(1, color.b * 1.1)
                }

                const paint = paintLayer.current[r]?.[s]
                if (paint && paint.intensity > 0.01) {
                    const blend = paint.intensity * 0.8
                    color.r = color.r * (1 - blend) + paint.r * blend
                    color.g = color.g * (1 - blend) + paint.g * blend
                    color.b = color.b * (1 - blend) + paint.b * blend
                }

                colors[idx] = color.r
                colors[idx + 1] = color.g
                colors[idx + 2] = color.b
            }
        }

        tunnelGeometry.attributes.position.needsUpdate = true
        tunnelGeometry.attributes.color.needsUpdate = true
        tunnelGeometry.computeVertexNormals()

        if (meshRef.current) meshRef.current.position.z = scrollOffset.current
        if (wireframeRef.current) wireframeRef.current.position.z = scrollOffset.current

        updateParticles(deltaToUse, timeToUse, centroid, onBeat, beatIntensity)

        const wobbleX = Math.sin(timeToUse * 2) * sMid * 4
        const wobbleY = Math.cos(timeToUse * 1.7) * sMid * 4

        camera.position.set(wobbleX, wobbleY, 8)
        cameraRotation.current += sHigh * deltaToUse * 0.2
        camera.rotation.z = Math.sin(cameraRotation.current) * 0.1
        camera.lookAt(wobbleX * 0.2, wobbleY * 0.2, -30)

        if (centerLightRef.current) {
            centerLightRef.current.color.setHSL(centroid * 0.5 + 0.4, 0.9, 0.7)
            centerLightRef.current.intensity = 2 + sAmp * 4
        }

        if (onBeat && beatIntensity > 0.5) {
            wireMaterial.opacity = 0.5 + beatIntensity * 0.4
            wireMaterial.color.setHSL(centroid, 1, 0.8)
        } else {
            wireMaterial.opacity = Math.max(0.1, wireMaterial.opacity - deltaToUse * 3)
        }
    })

    const updateParticles = (delta, elapsed, centroid, onBeat, beatIntensity) => {
        if (!particleGeometry) return

        const positions = particleGeometry.attributes.position.array
        const colors = particleGeometry.attributes.color.array
        const sizes = particleGeometry.attributes.size.array
        const tunnelLength = rings * ringSpacing
        const speedMult = 1 + smoothedAudio.current.amplitude * 2

        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < segments; s++) {
                if (paintLayer.current[r]?.[s]) {
                    paintLayer.current[r][s].intensity *= 0.995
                }
            }
        }

        for (let i = 0; i < particles.current.length; i++) {
            const p = particles.current[i]

            p.trail.unshift({ x: p.x, y: p.y, z: p.z })
            if (p.trail.length > trailLength) p.trail.pop()

            p.z += p.vz * delta * speedMult
            p.angle += delta * 0.5 * (p.vz > 0 ? 1 : -1)
            p.x = Math.cos(p.angle + tunnelRotation.current) * p.radius
            p.y = Math.sin(p.angle + tunnelRotation.current) * p.radius

            const localZ = p.z - scrollOffset.current
            const ringIndex = Math.floor(-localZ / ringSpacing)

            if (ringIndex >= 0 && ringIndex < rings && heightMap.current[ringIndex]) {
                const particleAngle = Math.atan2(p.y, p.x)
                let segmentIndex = Math.floor(((particleAngle + Math.PI) / (Math.PI * 2)) * segments)
                segmentIndex = ((segmentIndex % segments) + segments) % segments

                const displacement = heightMap.current[ringIndex][segmentIndex] || 0
                const wallRadius = baseRadius - displacement

                if (p.radius >= wallRadius - 0.5) {
                    const directionHue = p.vz > 0 ? 0.1 : 0.6
                    const finalHue = (directionHue + p.hue + centroid * 0.3) % 1
                    const splashColor = new THREE.Color()
                    splashColor.setHSL(finalHue, 0.9, 0.6)

                    for (let dr = -1; dr <= 1; dr++) {
                        for (let ds = -2; ds <= 2; ds++) {
                            const rr = ringIndex + dr
                            const ss = ((segmentIndex + ds) % segments + segments) % segments

                            if (rr >= 0 && rr < rings && paintLayer.current[rr]?.[ss]) {
                                const falloff = 1 / (1 + Math.abs(dr) + Math.abs(ds) * 0.5)
                                const paint = paintLayer.current[rr][ss]
                                paint.r = paint.r * 0.7 + splashColor.r * 0.3 * falloff
                                paint.g = paint.g * 0.7 + splashColor.g * 0.3 * falloff
                                paint.b = paint.b * 0.7 + splashColor.b * 0.3 * falloff
                                paint.intensity = Math.min(1, paint.intensity + 0.4 * falloff)
                            }
                        }
                    }

                    p.radius = Math.max(3, wallRadius - 2 - Math.random() * 3)
                    p.angle += (Math.random() - 0.5) * 0.5
                    p.hue = Math.random()
                }
            }

            if (p.z > 20) {
                p.z = -tunnelLength
                p.hue = Math.random()
                p.radius = 3 + Math.random() * (baseRadius - 6)
            } else if (p.z < -tunnelLength) {
                p.z = 15
                p.hue = Math.random()
                p.radius = 3 + Math.random() * (baseRadius - 6)
            }

            if (onBeat && beatIntensity > 0.6 && Math.random() < 0.3) {
                p.vz *= 1.5
            }
            const baseSpeed = (p.vz > 0 ? 1 : -1) * 30
            p.vz = p.vz * 0.98 + baseSpeed * 0.02
            p.radius += delta * 0.5

            for (let t = 0; t < trailLength; t++) {
                const idx = (i * trailLength + t) * 3

                if (t < p.trail.length) {
                    positions[idx] = p.trail[t].x
                    positions[idx + 1] = p.trail[t].y
                    positions[idx + 2] = p.trail[t].z
                } else {
                    positions[idx] = p.x
                    positions[idx + 1] = p.y
                    positions[idx + 2] = p.z
                }

                const trailFade = 1 - (t / trailLength)
                const hueShift = p.hue + t * 0.05
                const directionHue = p.vz > 0 ? 0.1 : 0.6
                const finalHue = (directionHue + hueShift + centroid * 0.3) % 1

                const color = new THREE.Color()
                color.setHSL(finalHue, 0.9, 0.5 + trailFade * 0.3)

                colors[idx] = color.r * trailFade
                colors[idx + 1] = color.g * trailFade
                colors[idx + 2] = color.b * trailFade

                sizes[i * trailLength + t] = p.size * (1 - t / trailLength * 0.7)
            }
        }

        particleGeometry.attributes.position.needsUpdate = true
        particleGeometry.attributes.color.needsUpdate = true
        particleGeometry.attributes.size.needsUpdate = true

        if (particleMeshRef.current) {
            particleMeshRef.current.position.z = scrollOffset.current
        }
    }

    useEffect(() => {
        console.log('WormholeNative mounted')
        return () => console.log('WormholeNative unmounted')
    }, [])

    return (
        <group ref={groupRef}>
            <mesh ref={meshRef} geometry={tunnelGeometry} material={solidMaterial} />
            <mesh ref={wireframeRef} geometry={tunnelGeometry} material={wireMaterial} />

            <points ref={particleMeshRef} geometry={particleGeometry} material={particleMaterial} />

            <mesh ref={playerRef} geometry={playerGeometry} material={playerMaterial}>
                <mesh ref={playerTrailRef} geometry={playerTrailGeometry} material={playerTrailMaterial} position={[0, 0, 2]} />
            </mesh>

            <pointLight ref={centerLightRef} intensity={2} distance={150} position={[0, 0, 10]} />
            <ambientLight intensity={1.2} color={0x333355} />
        </group>
    )
}
