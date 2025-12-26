import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uTwist;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vNormal = normal;

    vec3 pos = position;

    float twist = uTwist * sin(pos.z * 0.1 + uTime);
    float c = cos(twist);
    float s = sin(twist);
    vec3 twisted = pos;
    twisted.x = pos.x * c - pos.y * s;
    twisted.y = pos.x * s + pos.y * c;

    float noise = snoise(pos * uNoiseScale * 0.1 + uTime * uNoiseSpeed);
    twisted += normal * noise * 0.5;

    vPosition = twisted;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(twisted, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uColorCycle;
  uniform float uFresnelPower;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), uFresnelPower);

    float colorT = vUv.y + uColorCycle + uMid * 0.5;
    vec3 color = palette(colorT);

    color *= 0.5 + uBass * 0.5;
    color += vec3(0.2, 0.5, 1.0) * uHigh * fresnel;

    color += palette(colorT + 0.3) * fresnel * 0.8;

    color *= 0.8 + sin(uTime * 2.0) * 0.2 * uBass;

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function PsychedelicMode({ audioContext, params, visualTime, isRecording }) {
  const meshRef = useRef()
  const smoothedAudio = useRef({ bass: 0, mid: 0, high: 0 })
  const rotationRef = useRef({ y: 0, x: 0 })
  const colorCycleRef = useRef(0)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uTwist: { value: params.twistAmount || 0.5 },
        uNoiseScale: { value: params.noiseScale || 2 },
        uNoiseSpeed: { value: params.noiseSpeed || 0.5 },
        uColorCycle: { value: 0 },
        uFresnelPower: { value: params.fresnelPower || 2 }
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide
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
    material.uniforms.uTwist.value = p.twistAmount ?? 0.5
    material.uniforms.uNoiseScale.value = p.noiseScale ?? 2
    material.uniforms.uNoiseSpeed.value = p.noiseSpeed ?? 0.5
    material.uniforms.uColorCycle.value = (p.colorCycle ?? 0) + timeToUse * 0.2
    material.uniforms.uFresnelPower.value = p.fresnelPower ?? 2

    rotationRef.current.y += deltaToUse * 0.05
    rotationRef.current.x = Math.sin(timeToUse * 0.08) * 0.1

    if (meshRef.current) {
      meshRef.current.rotation.y = rotationRef.current.y
      meshRef.current.rotation.x = rotationRef.current.x
    }
  })

  return (
    <group>
      <mesh ref={meshRef} material={material}>
        <torusKnotGeometry args={[3, 1, 200, 32]} />
      </mesh>
      <pointLight color="#ff00ff" intensity={2} distance={50} position={[5, 5, 5]} />
      <pointLight color="#00ffff" intensity={1.5} distance={40} position={[-5, -5, 5]} />
      <ambientLight intensity={0.2} />
    </group>
  )
}
