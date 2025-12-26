import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioStore } from '../stores/audioStore'
import { useTunerStore } from '../stores/tunerStore'

const pitchTempoToColor = (centroid, tempo, amplitude) => {
  const hue = (centroid * 0.5 + tempo * 0.3 + 0.5) % 1
  const saturation = 0.7 + amplitude * 0.3
  const lightness = 0.4 + amplitude * 0.3
  return new THREE.Color().setHSL(hue, saturation, lightness)
}

const pitchTempoToRGB = (centroid, tempo, amplitude) => {
  const color = pitchTempoToColor(centroid, tempo, amplitude)
  return { r: Math.floor(color.r * 255), g: Math.floor(color.g * 255), b: Math.floor(color.b * 255) }
}

class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256)
    this.perm = new Uint8Array(512)
    this.permMod12 = new Uint8Array(512)
    for (let i = 0; i < 256; i++) {
      this.p[i] = i
    }
    let n = seed * 256
    for (let i = 255; i > 0; i--) {
      n = (n * 16807) % 2147483647
      const j = Math.floor((n / 2147483647) * (i + 1))
      ;[this.p[i], this.p[j]] = [this.p[j], this.p[i]]
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255]
      this.permMod12[i] = this.perm[i] % 12
    }
  }
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1)
    const G2 = (3 - Math.sqrt(3)) / 6
    const grad3 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const t = (i + j) * G2
    const X0 = i - t
    const Y0 = j - t
    const x0 = x - X0
    const y0 = y - Y0
    let i1, j1
    if (x0 > y0) { i1 = 1; j1 = 0 } else { i1 = 0; j1 = 1 }
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    const gi0 = this.permMod12[ii + this.perm[jj]]
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]]
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]]
    let n0 = 0, n1 = 0, n2 = 0
    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0) }
    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1) }
    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2) }
    return 70 * (n0 + n1 + n2)
  }
}

class FlowField {
  constructor(width, height, resolution = 20) {
    this.width = width
    this.height = height
    this.resolution = resolution
    this.cols = Math.ceil(width / resolution)
    this.rows = Math.ceil(height / resolution)
    this.field = new Array(this.cols * this.rows)
    this.noise = new SimplexNoise()
    this.time = 0
    this.noiseScale = 0.005
    this.timeScale = 0.0005
  }
  update(audioFeatures) {
    const { bass, mid, high, amplitude } = audioFeatures
    const turbulence = 0.5 + high * 2
    const strength = 0.5 + bass * 2
    const rotation = mid * Math.PI
    this.time += this.timeScale * (1 + amplitude * 3)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = x + y * this.cols
        let angle = 0
        let amp = 1
        let freq = this.noiseScale
        for (let octave = 0; octave < 3; octave++) {
          const noiseVal = this.noise.noise2D(x * freq * turbulence, y * freq * turbulence + this.time)
          angle += noiseVal * amp
          amp *= 0.5
          freq *= 2
        }
        angle = angle * Math.PI * 2 + rotation
        this.field[idx] = { angle, strength: strength * (0.5 + Math.abs(this.noise.noise2D(x * 0.01, y * 0.01))) }
      }
    }
  }
  getVector(x, y) {
    const col = Math.floor(x / this.resolution)
    const row = Math.floor(y / this.resolution)
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return { x: 0, y: 0 }
    const idx = col + row * this.cols
    const { angle, strength } = this.field[idx]
    return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength }
  }
  resize(width, height) {
    this.width = width
    this.height = height
    this.cols = Math.ceil(width / this.resolution)
    this.rows = Math.ceil(height / this.resolution)
    this.field = new Array(this.cols * this.rows)
  }
}

class Particle {
  constructor(x, y, color, rgb, size = 2) {
    this.x = x
    this.y = y
    this.originX = x
    this.originY = y
    this.vx = 0
    this.vy = 0
    this.color = color
    this.rgb = rgb
    this.size = size
    this.baseSize = size
    this.life = 1
    this.maxLife = 1
    this.age = 0
    this.trail = []
    this.maxTrailLength = 20
  }
  update(flowField, audioFeatures, beatInfo) {
    const flow = flowField.getVector(this.x, this.y)
    this.vx = this.vx * 0.9 + flow.x * 0.5
    this.vy = this.vy * 0.9 + flow.y * 0.5
    if (beatInfo.onBeat) {
      const angle = Math.random() * Math.PI * 2
      this.vx += Math.cos(angle) * beatInfo.beatIntensity * 2
      this.vy += Math.sin(angle) * beatInfo.beatIntensity * 2
    }
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > this.maxTrailLength) this.trail.shift()
    this.x += this.vx
    this.y += this.vy
    this.size = this.baseSize * (0.5 + audioFeatures.amplitude * 1.5)
    this.age++
  }
  draw(ctx, alpha = 1) {
    if (this.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.trail[0].x, this.trail[0].y)
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y)
      }
      ctx.strokeStyle = `rgba(${this.rgb.r}, ${this.rgb.g}, ${this.rgb.b}, ${alpha * 0.3})`
      ctx.lineWidth = this.size * 0.5
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${this.rgb.r}, ${this.rgb.g}, ${this.rgb.b}, ${alpha})`
    ctx.fill()
  }
  isOffScreen(width, height) {
    const margin = 50
    return this.x < -margin || this.x > width + margin || this.y < -margin || this.y > height + margin
  }
}

class ParticleSystem {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.particles = []
    this.maxParticles = 5000
    this.spawnRate = 10
    this.accumulatedParticles = []
  }
  spawn(audioFeatures, beatInfo, count = 1) {
    const { amplitude, centroid } = audioFeatures
    const { normalizedTempo, onBeat, beatIntensity } = beatInfo
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break
      let x, y
      if (onBeat && Math.random() < 0.3) {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * 100
        x = this.width / 2 + Math.cos(angle) * dist
        y = this.height / 2 + Math.sin(angle) * dist
      } else {
        const centerBias = 0.3
        x = this.width * (Math.random() * (1 - centerBias) + centerBias * 0.5 + (Math.random() - 0.5) * centerBias)
        y = this.height * (Math.random() * (1 - centerBias) + centerBias * 0.5 + (Math.random() - 0.5) * centerBias)
      }
      const pitch = centroid + (Math.random() - 0.5) * 0.2
      const color = pitchTempoToColor(pitch, normalizedTempo, amplitude)
      const rgb = pitchTempoToRGB(pitch, normalizedTempo, amplitude)
      const size = 1 + amplitude * 3 + (onBeat ? beatIntensity * 2 : 0)
      const particle = new Particle(x, y, color, rgb, size)
      particle.maxTrailLength = Math.floor(10 + normalizedTempo * 30)
      this.particles.push(particle)
    }
  }
  update(flowField, audioFeatures, beatInfo) {
    const spawnCount = Math.floor(this.spawnRate * (0.5 + audioFeatures.amplitude * 2))
    this.spawn(audioFeatures, beatInfo, spawnCount)
    if (beatInfo.onBeat) {
      this.spawn(audioFeatures, beatInfo, Math.floor(20 * beatInfo.beatIntensity))
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.update(flowField, audioFeatures, beatInfo)
      if (p.isOffScreen(this.width, this.height) || p.age > 500) {
        this.accumulatedParticles.push({ x: p.x, y: p.y, rgb: p.rgb, size: p.size * 0.5 })
        this.particles.splice(i, 1)
      }
    }
    const maxAccumulated = 50000
    if (this.accumulatedParticles.length > maxAccumulated) {
      this.accumulatedParticles = this.accumulatedParticles.slice(-maxAccumulated)
    }
  }
  draw(ctx) {
    for (const p of this.accumulatedParticles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, 0.3)`
      ctx.fill()
    }
    for (const p of this.particles) {
      p.draw(ctx)
    }
  }
  resize(width, height) {
    this.width = width
    this.height = height
  }
  clear() {
    this.particles = []
    this.accumulatedParticles = []
  }
}

export default function FlowParticlesMode({ audioContext, params }) {
  const { size } = useThree()
  const canvasRef = useRef(document.createElement('canvas'))
  const modeRef = useRef(null)

  const getAudioData = useAudioStore(s => s.getAudioData)
  const tunerParams = useTunerStore(s => s.params)

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = size.width
    canvas.height = size.height

    const flowField = new FlowField(size.width, size.height, 20)
    const particleSystem = new ParticleSystem(size.width, size.height)

    modeRef.current = {
      ctx: canvas.getContext('2d'),
      width: size.width,
      height: size.height,
      flowField,
      particleSystem,
      getWeightedAudio(audioFeatures) {
        const p = tunerParams || { bassWeight: 0.5, midWeight: 0.5, highWeight: 0.5 }
        return {
          ...audioFeatures,
          bass: audioFeatures.bass * (0.5 + p.bassWeight),
          mid: audioFeatures.mid * (0.5 + p.midWeight),
          high: audioFeatures.high * (0.5 + p.highWeight)
        }
      },
      clearBackground(opacity = 1) {
        const p = tunerParams || { decay: 0.5 }
        const decay = p.decay || 0.5
        let effectiveOpacity = opacity * (1 - decay * 0.95)
        this.ctx.fillStyle = `rgba(10, 10, 10, ${effectiveOpacity})`
        this.ctx.fillRect(0, 0, this.width, this.height)
      },
      update(audioFeatures, beatInfo) {
        const weighted = this.getWeightedAudio(audioFeatures)
        this.flowField.update(weighted)
        this.particleSystem.update(this.flowField, weighted, beatInfo)
      },
      draw() {
        this.clearBackground(0.02)
        this.particleSystem.draw(this.ctx)
      },
      clear() {
        this.clearBackground(1)
        this.particleSystem.clear()
      }
    }

    return () => {
      if (modeRef.current) modeRef.current.clear()
    }
  }, [size.width, size.height])

  useFrame(() => {
    if (!modeRef.current) return
    const audioData = getAudioData()
    modeRef.current.update(audioData.features, audioData.beatInfo)
    modeRef.current.draw()
  })

  const texture = useMemo(() => {
    const canvas = canvasRef.current
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    return tex
  }, [])

  useFrame(() => {
    if (texture) texture.needsUpdate = true
  })

  return (
    <mesh scale={[size.width / 100, size.height / 100, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent={true} />
    </mesh>
  )
}
