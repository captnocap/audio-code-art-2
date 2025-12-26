import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uBass;

  void main() {
    vUv = uv;
    vPosition = position;

    vec3 pos = position;
    float wave = sin(uv.y * 20.0 - uTime * 3.0) * 0.5 * uBass;
    pos.x += wave * 0.5;
    pos.y += cos(uv.y * 15.0 - uTime * 2.0) * 0.3 * uBass;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uTunnelSpeed;
  uniform float uRingFrequency;
  varying vec2 vUv;
  varying vec3 vPosition;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    float depth = clamp(-vPosition.z / 100.0, 0.0, 1.0);

    float rings = sin(vUv.y * uRingFrequency * 20.0 - uTime * uTunnelSpeed * 5.0);
    rings = smoothstep(0.3, 0.5, rings);

    float angle = atan(vPosition.y, vPosition.x);
    float spiral = sin(angle * 4.0 + vUv.y * 30.0 - uTime * 3.0);
    spiral = smoothstep(0.3, 0.7, spiral);

    float hue = fract(vUv.y + uTime * 0.1 + uMid * 0.5);
    vec3 color = hsv2rgb(vec3(hue, 0.8, 0.9));

    float intensity = rings * 0.5 + spiral * 0.3 + uBass * 0.2;
    vec3 col = color * intensity * (1.0 - depth * 0.5);

    float edge = abs(vUv.x - 0.5) * 2.0;
    col += hsv2rgb(vec3(hue + 0.2, 1.0, 1.0)) * pow(edge, 3.0) * uHigh;

    col = mix(col, vec3(0.0, 0.0, 0.05), depth * depth);

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function WormholeMode({ audioContext, params, visualTime, isRecording }) {
  const meshRef = useRef()
  const smoothedAudio = useRef({ bass: 0, mid: 0, high: 0 })
  const rotationRef = useRef(0)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uTunnelSpeed: { value: params.tunnelSpeed || 1 },
        uRingFrequency: { value: params.ringFrequency || 8 }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending
    })
  }, [])

  useFrame((state, delta) => {
    const { bass = 0, mid = 0, high = 0 } = audioContext || {}

    smoothedAudio.current.bass = bass
    smoothedAudio.current.mid = mid
    smoothedAudio.current.high = high

    const p = params.current || {}
    const timeToUse = visualTime !== undefined ? visualTime : state.clock.elapsedTime
    const deltaToUse = isRecording ? Math.min(delta, 0.05) : delta

    material.uniforms.uTime.value = timeToUse
    material.uniforms.uBass.value = bass
    material.uniforms.uMid.value = mid
    material.uniforms.uHigh.value = high
    material.uniforms.uTunnelSpeed.value = p.tunnelSpeed ?? 1
    material.uniforms.uRingFrequency.value = p.ringFrequency ?? 8

    rotationRef.current += deltaToUse * 0.02
    if (meshRef.current) {
      meshRef.current.rotation.z = rotationRef.current
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(10, 10, 100, 48, 100, true)
    geo.rotateX(Math.PI / 2)
    geo.translate(0, 0, -50)
    return geo
  }, [])

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material} />
      <pointLight color="#00ffff" intensity={2} distance={80} position={[0, 0, 5]} />
      <pointLight color="#ff00ff" intensity={1.5} distance={60} position={[5, 0, -30]} />
    </group>
  )
}
