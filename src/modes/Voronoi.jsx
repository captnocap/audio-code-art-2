import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_SITES = 64

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform vec3 uSites[${MAX_SITES}];  // xy = position, z = hue
  uniform int uNumSites;

  varying vec2 vUv;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Attempt worley noise pattern inside cells
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 pos = vUv * uResolution;

    float minDist = 1e10;
    float secondDist = 1e10;
    float thirdDist = 1e10;
    float nearestHue = 0.0;
    vec2 nearestSite = vec2(0.0);
    int nearestIdx = 0;

    for (int i = 0; i < ${MAX_SITES}; i++) {
      if (i >= uNumSites) break;

      vec2 sitePos = uSites[i].xy;
      float hue = uSites[i].z;

      float dist = distance(pos, sitePos);

      if (dist < minDist) {
        thirdDist = secondDist;
        secondDist = minDist;
        minDist = dist;
        nearestHue = hue;
        nearestSite = sitePos;
        nearestIdx = i;
      } else if (dist < secondDist) {
        thirdDist = secondDist;
        secondDist = dist;
      } else if (dist < thirdDist) {
        thirdDist = dist;
      }
    }

    // Edge detection - where two cells meet
    float edgeDist = secondDist - minDist;
    float edge = smoothstep(0.0, 4.0 + uBass * 8.0, edgeDist);

    // Inner glow near center
    float centerGlow = 1.0 - smoothstep(0.0, 80.0 + uBass * 60.0, minDist);

    // Cell color based on hue with time shift
    float hueShift = uTime * 0.1 + uBeat * 0.3;
    float saturation = 0.75 + uMid * 0.25;
    float value = 0.55 + uBass * 0.35;
    vec3 cellColor = hsv2rgb(vec3(nearestHue + hueShift, saturation, value));

    // Secondary color for variation
    vec3 secondaryColor = hsv2rgb(vec3(nearestHue + hueShift + 0.15, saturation * 0.9, value * 1.2));

    // Radial gradient within cell
    float radialGrad = minDist / (minDist + secondDist);
    cellColor = mix(secondaryColor, cellColor, radialGrad);

    // Pulsing veins along edges
    float veinPulse = sin(edgeDist * 0.5 - uTime * 4.0 + nearestHue * 6.28) * 0.5 + 0.5;
    float veins = smoothstep(6.0, 2.0, edgeDist) * veinPulse * uMid;

    // Edge glow color (complementary)
    vec3 edgeGlowColor = hsv2rgb(vec3(nearestHue + hueShift + 0.5, 1.0, 1.0));

    // Combine everything
    vec3 edgeColor = mix(cellColor * 0.1, edgeGlowColor * 0.6, veins);
    vec3 color = mix(edgeColor, cellColor, edge);

    // Center highlight
    color += secondaryColor * centerGlow * 0.4 * (1.0 + uBass);

    // Beat explosion ripple
    float ripple = sin(minDist * 0.15 - uTime * 8.0) * 0.5 + 0.5;
    color += edgeGlowColor * ripple * uBeat * 0.5;

    // High frequency sparkle
    float sparkle = hash(pos + uTime * 100.0);
    color += vec3(1.0) * step(0.995, sparkle) * uHigh * 2.0;

    // Chromatic edge effect
    float chromatic = smoothstep(8.0, 0.0, edgeDist);
    color.r += chromatic * 0.15 * sin(uTime * 3.0);
    color.b += chromatic * 0.15 * cos(uTime * 3.0);

    // Overall beat flash
    color += vec3(1.0, 0.9, 0.8) * uBeat * 0.2;

    // Subtle vignette
    vec2 uv = vUv - 0.5;
    float vignette = 1.0 - dot(uv, uv) * 0.5;
    color *= vignette;

    // Clamp and output
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

class VoronoiSite {
  constructor(x, y, hue) {
    this.x = x
    this.y = y
    this.homeX = x
    this.homeY = y
    this.vx = 0
    this.vy = 0
    this.hue = hue
  }

  update(attractStrength) {
    const dx = this.homeX - this.x
    const dy = this.homeY - this.y
    this.vx += dx * attractStrength
    this.vy += dy * attractStrength
    this.vx *= 0.92
    this.vy *= 0.92
    this.x += this.vx
    this.y += this.vy
  }

  explode(centerX, centerY, force) {
    const dx = this.x - centerX
    const dy = this.y - centerY
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.vx += (dx / dist) * force
    this.vy += (dy / dist) * force
  }
}

export default function VoronoiMode({ audioContext, params }) {
  const { size } = useThree()
  const meshRef = useRef()
  const sitesRef = useRef([])
  const beatAccum = useRef(0)

  const numSites = 48

  // Initialize sites
  useEffect(() => {
    const sites = []
    const cols = Math.ceil(Math.sqrt(numSites * size.width / size.height))
    const rows = Math.ceil(numSites / cols)

    for (let i = 0; i < numSites; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = (col + 0.5 + (Math.random() - 0.5) * 0.6) * (size.width / cols)
      const y = (row + 0.5 + (Math.random() - 0.5) * 0.6) * (size.height / rows)
      const hue = Math.random()
      sites.push(new VoronoiSite(x, y, hue))
    }

    sitesRef.current = sites
  }, [size.width, size.height, numSites])

  const material = useMemo(() => {
    const sitesArray = new Array(MAX_SITES * 3).fill(0)

    return new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uBeat: { value: 0 },
        uSites: { value: sitesArray },
        uNumSites: { value: numSites }
      },
      vertexShader,
      fragmentShader
    })
  }, [])

  useEffect(() => {
    material.uniforms.uResolution.value.set(size.width, size.height)
  }, [size, material])

  useFrame((state, delta) => {
    const { bass = 0, mid = 0, high = 0, beat = 0 } = audioContext || {}
    const sites = sitesRef.current

    // Decay beat accumulator
    beatAccum.current *= 0.85
    if (beat > 0.5) {
      beatAccum.current = 1
      // Explode on beat
      const force = beat * 25
      const cx = size.width / 2
      const cy = size.height / 2
      for (const site of sites) {
        site.explode(cx, cy, force)
      }
    }

    // High frequency jitter
    if (high > 0.4) {
      const jitter = (high - 0.4) * 6
      for (const site of sites) {
        site.x += (Math.random() - 0.5) * jitter
        site.y += (Math.random() - 0.5) * jitter
      }
    }

    // Update sites physics
    const attractStrength = 0.03 + (1 - bass) * 0.04
    for (const site of sites) {
      site.update(attractStrength)
      // Slowly shift hue
      site.hue = (site.hue + delta * 0.02 * (0.5 + mid)) % 1
    }

    // Update shader uniforms
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uBass.value = bass
    material.uniforms.uMid.value = mid
    material.uniforms.uHigh.value = high
    material.uniforms.uBeat.value = beatAccum.current

    // Pack sites into uniform array
    const sitesArray = []
    for (let i = 0; i < MAX_SITES; i++) {
      if (i < sites.length) {
        sitesArray.push(sites[i].x, sites[i].y, sites[i].hue)
      } else {
        sitesArray.push(0, 0, 0)
      }
    }
    material.uniforms.uSites.value = sitesArray
  })

  return (
    <mesh ref={meshRef} material={material} scale={[size.width / 100, size.height / 100, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
