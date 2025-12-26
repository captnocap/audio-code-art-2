import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioStore } from '../stores/audioStore'
import { useTunerStore } from '../stores/tunerStore'

const pitchTempoToRGB = (centroid, tempo, amplitude) => {
  const hue = (centroid * 0.5 + tempo * 0.3 + 0.5) % 1
  const saturation = 0.7 + amplitude * 0.3
  const lightness = 0.4 + amplitude * 0.3
  const color = new THREE.Color().setHSL(hue, saturation, lightness)
  return { r: Math.floor(color.r * 255), g: Math.floor(color.g * 255), b: Math.floor(color.b * 255) }
}

class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256)
    this.perm = new Uint8Array(512)
    this.permMod12 = new Uint8Array(512)
    for (let i = 0; i < 256; i++) this.p[i] = i
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
  constructor(width, height, resolution = 25) {
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

export default function MirrorMode({ audioContext, params }) {
  const { size } = useThree()
  const canvasRef = useRef(document.createElement('canvas'))
  const modeRef = useRef(null)

  const getAudioData = useAudioStore(s => s.getAudioData)
  const tunerParams = useTunerStore(s => s.params)

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = size.width
    canvas.height = size.height

    modeRef.current = {
      ctx: canvas.getContext('2d'),
      width: size.width,
      height: size.height,
      segments: 8,
      flowField: new FlowField(size.width, size.height, 25),
      particles: [],
      maxParticles: 1000,
      centerX: size.width / 2,
      centerY: size.height / 2,
      init() {
        this.centerX = this.width / 2
        this.centerY = this.height / 2
        this.flowField = new FlowField(this.width, this.height, 25)
        this.particles = []
      },
      getWeightedAudio(audioFeatures) {
        const p = tunerParams || { bassWeight: 0.5, midWeight: 0.5, highWeight: 0.5 }
        return {
          ...audioFeatures,
          bass: audioFeatures.bass * (0.5 + p.bassWeight),
          mid: audioFeatures.mid * (0.5 + p.midWeight),
          high: audioFeatures.high * (0.5 + p.highWeight)
        }
      },
      update(audioFeatures, beatInfo) {
        const weighted = this.getWeightedAudio(audioFeatures)
        const { amplitude, centroid } = weighted
        const { onBeat, beatIntensity, normalizedTempo } = beatInfo

        this.flowField.update(audioFeatures)

        const spawnCount = Math.floor(3 + amplitude * 5)
        for (let i = 0; i < spawnCount; i++) {
          if (this.particles.length >= this.maxParticles) break
          const angle = Math.random() * (Math.PI * 2 / this.segments)
          const dist = 20 + Math.random() * Math.min(this.width, this.height) * 0.4
          this.particles.push({
            x: this.centerX + Math.cos(angle) * dist,
            y: this.centerY + Math.sin(angle) * dist,
            vx: 0, vy: 0,
            size: 1 + amplitude * 2,
            rgb: pitchTempoToRGB(centroid + (Math.random() - 0.5) * 0.2, normalizedTempo, amplitude),
            alpha: 0.6 + amplitude * 0.4,
            life: 1, trail: []
          })
        }

        if (onBeat) {
          for (let i = 0; i < 10 * beatIntensity; i++) {
            const angle = Math.random() * (Math.PI * 2 / this.segments)
            const dist = 10 + Math.random() * 50
            this.particles.push({
              x: this.centerX + Math.cos(angle) * dist,
              y: this.centerY + Math.sin(angle) * dist,
              vx: Math.cos(angle) * beatIntensity * 3,
              vy: Math.sin(angle) * beatIntensity * 3,
              size: 2 + beatIntensity * 3,
              rgb: pitchTempoToRGB(centroid, normalizedTempo, amplitude),
              alpha: 0.8, life: 1, trail: []
            })
          }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i]
          const flow = this.flowField.getVector(p.x, p.y)
          p.vx = p.vx * 0.95 + flow.x * 0.3
          p.vy = p.vy * 0.95 + flow.y * 0.3
          p.trail.push({ x: p.x, y: p.y })
          if (p.trail.length > 15) p.trail.shift()
          p.x += p.vx
          p.y += p.vy
          p.life -= 0.005
          p.alpha = p.life * 0.8
          if (p.life <= 0) this.particles.splice(i, 1)
        }
      },
      draw() {
        const ctx = this.ctx
        ctx.fillStyle = 'rgba(10, 10, 10, 0.05)'
        ctx.fillRect(0, 0, this.width, this.height)
        const segmentAngle = (Math.PI * 2) / this.segments

        for (const p of this.particles) {
          const relX = p.x - this.centerX
          const relY = p.y - this.centerY
          const dist = Math.hypot(relX, relY)
          const angle = Math.atan2(relY, relX)

          for (let s = 0; s < this.segments; s++) {
            const segAngle = s * segmentAngle
            const mirror = s % 2 === 1
            let drawAngle = mirror ? segAngle - angle : segAngle + angle
            const drawX = this.centerX + Math.cos(drawAngle) * dist
            const drawY = this.centerY + Math.sin(drawAngle) * dist

            if (p.trail.length > 1) {
              ctx.beginPath()
              for (let t = 0; t < p.trail.length; t++) {
                const tRelX = p.trail[t].x - this.centerX
                const tRelY = p.trail[t].y - this.centerY
                const tDist = Math.hypot(tRelX, tRelY)
                const tAngle = Math.atan2(tRelY, tRelX)
                const tDrawAngle = mirror ? segAngle - tAngle : segAngle + tAngle
                const tx = this.centerX + Math.cos(tDrawAngle) * tDist
                const ty = this.centerY + Math.sin(tDrawAngle) * tDist
                if (t === 0) ctx.moveTo(tx, ty)
                else ctx.lineTo(tx, ty)
              }
              ctx.strokeStyle = `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, ${p.alpha * 0.3})`
              ctx.lineWidth = p.size * 0.5
              ctx.stroke()
            }

            ctx.beginPath()
            ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, ${p.alpha})`
            ctx.fill()
          }
        }
      },
      clear() {
        this.ctx.fillStyle = '#0a0a0a'
        this.ctx.fillRect(0, 0, this.width, this.height)
        this.particles = []
      }
    }

    modeRef.current.init()

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
