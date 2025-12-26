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

class CymaticsParticle {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.settled = false
    this.settleTime = 0
  }
}

export default function CymaticsMode({ audioContext, params }) {
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
      particles: [],
      maxParticles: 12000,
      n: 3,
      m: 2,
      targetN: 3,
      targetM: 2,
      plateSize: 0,
      centerX: 0,
      centerY: 0,
      vibrationIntensity: 0,
      phase: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothHigh: 0,
      smoothAmplitude: 0,
      accumulation: null,
      chladniPattern(x, y) {
        const px = (x - this.centerX) / this.plateSize
        const py = (y - this.centerY) / this.plateSize
        if (px * px + py * py > 1) return 0
        const n = this.n
        const m = this.m
        const pattern1 = Math.cos(n * Math.PI * px) * Math.cos(m * Math.PI * py)
        const pattern2 = Math.cos(m * Math.PI * px) * Math.cos(n * Math.PI * py)
        return pattern1 - pattern2
      },
      chladniGradient(x, y) {
        const epsilon = 2
        const center = Math.abs(this.chladniPattern(x, y))
        const dx = Math.abs(this.chladniPattern(x + epsilon, y)) - center
        const dy = Math.abs(this.chladniPattern(x, y + epsilon)) - center
        const mag = Math.sqrt(dx * dx + dy * dy) || 1
        return { x: -dx / mag, y: -dy / mag }
      },
      spawnParticles(count) {
        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
          const angle = Math.random() * Math.PI * 2
          const radius = Math.random() * this.plateSize
          this.particles.push(new CymaticsParticle(
            this.centerX + Math.cos(angle) * radius,
            this.centerY + Math.sin(angle) * radius
          ))
        }
      },
      init() {
        this.particles = []
        this.n = 3
        this.m = 2
        this.targetN = 3
        this.targetM = 2
        this.vibrationIntensity = 0
        this.phase = 0
        this.smoothBass = 0
        this.smoothMid = 0
        this.smoothHigh = 0
        this.smoothAmplitude = 0
        this.plateSize = Math.min(this.width, this.height) * 0.45
        this.centerX = this.width / 2
        this.centerY = this.height / 2
        this.accumulation = new Float32Array(this.width * this.height)
        this.spawnParticles(this.maxParticles * 0.8)
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
        const { bass, mid, high, amplitude, centroid, dominantFrequency } = weighted
        const { normalizedTempo, onBeat, beatIntensity } = beatInfo
        const smoothing = 0.1
        this.smoothBass += (bass - this.smoothBass) * smoothing
        this.smoothMid += (mid - this.smoothMid) * smoothing
        this.smoothHigh += (high - this.smoothHigh) * smoothing
        this.smoothAmplitude += (amplitude - this.smoothAmplitude) * smoothing
        this.vibrationIntensity = this.smoothAmplitude * 0.5 + this.smoothBass * 0.5
        this.phase += 0.1 + normalizedTempo * 0.2
        this.targetN = Math.floor(2 + dominantFrequency * 6)
        this.targetM = Math.floor(1 + centroid * 5)
        if (onBeat && beatIntensity > 0.5) {
          this.n = this.targetN
          this.m = this.targetM
          for (const p of this.particles) {
            p.settled = false
            p.vx += (Math.random() - 0.5) * beatIntensity * 20
            p.vy += (Math.random() - 0.5) * beatIntensity * 20
          }
          if (beatIntensity > 0.7) this.spawnParticles(100)
        }
        const settleDist = 0.08
        const attractionStrength = 0.8 + this.smoothBass * 1.0
        for (const p of this.particles) {
          const dx = p.x - this.centerX
          const dy = p.y - this.centerY
          const distFromCenter = Math.sqrt(dx * dx + dy * dy)
          if (distFromCenter > this.plateSize * 1.1) {
            p.x = this.centerX + (Math.random() - 0.5) * this.plateSize * 2
            p.y = this.centerY + (Math.random() - 0.5) * this.plateSize * 2
            p.settled = false
            continue
          }
          const patternValue = Math.abs(this.chladniPattern(p.x, p.y))
          if (!p.settled) {
            const grad = this.chladniGradient(p.x, p.y)
            p.vx += grad.x * attractionStrength * patternValue
            p.vy += grad.y * attractionStrength * patternValue
            const vibration = Math.sin(this.phase) * this.vibrationIntensity
            p.vx += (Math.random() - 0.5) * vibration
            p.vy += (Math.random() - 0.5) * vibration
            p.vx *= 0.88
            p.vy *= 0.88
            p.x += p.vx
            p.y += p.vy
            if (patternValue < settleDist && Math.abs(p.vx) < 1.0 && Math.abs(p.vy) < 1.0) {
              p.settleTime++
              if (p.settleTime > 10) p.settled = true
            } else {
              p.settleTime = Math.max(0, p.settleTime - 1)
            }
          } else {
            p.x += (Math.random() - 0.5) * this.vibrationIntensity * 0.5
            p.y += (Math.random() - 0.5) * this.vibrationIntensity * 0.5
            if (this.vibrationIntensity > 0.5 && Math.random() < 0.01) {
              p.settled = false
              p.settleTime = 0
            }
          }
          if (p.settled) {
            const px = Math.floor(p.x)
            const py = Math.floor(p.y)
            if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
              this.accumulation[py * this.width + px] += 0.1
            }
          }
        }
        for (let i = 0; i < this.accumulation.length; i++) {
          this.accumulation[i] *= 0.995
        }
      },
      drawNodalLines(ctx) {
        const step = 4
        ctx.strokeStyle = 'rgba(40, 40, 60, 0.3)'
        ctx.lineWidth = 1
        for (let y = this.centerY - this.plateSize; y < this.centerY + this.plateSize; y += step) {
          for (let x = this.centerX - this.plateSize; x < this.centerX + this.plateSize; x += step) {
            const val = this.chladniPattern(x, y)
            const valRight = this.chladniPattern(x + step, y)
            const valDown = this.chladniPattern(x, y + step)
            if (val * valRight < 0) {
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(x + step, y)
              ctx.stroke()
            }
            if (val * valDown < 0) {
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(x, y + step)
              ctx.stroke()
            }
          }
        }
      },
      drawAccumulation(ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height)
        const data = imageData.data
        for (let i = 0; i < this.accumulation.length; i++) {
          const acc = Math.min(this.accumulation[i], 1)
          if (acc > 0.1) {
            const idx = i * 4
            const brightness = Math.floor(acc * 100)
            data[idx] = Math.min(255, data[idx] + brightness)
            data[idx + 1] = Math.min(255, data[idx + 1] + brightness)
            data[idx + 2] = Math.min(255, data[idx + 2] + brightness + 20)
          }
        }
        ctx.putImageData(imageData, 0, 0)
      },
      draw() {
        const ctx = this.ctx
        ctx.fillStyle = 'rgb(10, 10, 10)'
        ctx.fillRect(0, 0, this.width, this.height)
        ctx.strokeStyle = 'rgba(50, 50, 70, 0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(this.centerX, this.centerY, this.plateSize, 0, Math.PI * 2)
        ctx.stroke()
        this.drawNodalLines(ctx)
        this.drawAccumulation(ctx)
        const particleColor = pitchTempoToRGB(0.5, 0.5, 0.8)
        for (const p of this.particles) {
          const alpha = p.settled ? 0.9 : 0.4
          const size = p.settled ? 1.5 : 1
          ctx.fillStyle = `rgba(${particleColor.r}, ${particleColor.g}, ${particleColor.b}, ${alpha})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.font = '12px monospace'
        ctx.fillText(`Pattern: n=${this.n}, m=${this.m}`, 10, 20)
        ctx.fillText(`Particles: ${this.particles.length}`, 10, 35)
      },
      clear() {
        this.particles = []
        this.n = 3
        this.m = 2
        this.targetN = 3
        this.targetM = 2
        this.vibrationIntensity = 0
        this.phase = 0
        this.smoothBass = 0
        this.smoothMid = 0
        this.smoothHigh = 0
        this.smoothAmplitude = 0
        if (this.accumulation) this.accumulation.fill(0)
        this.ctx.fillStyle = 'rgb(10, 10, 10)'
        this.ctx.fillRect(0, 0, this.width, this.height)
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
