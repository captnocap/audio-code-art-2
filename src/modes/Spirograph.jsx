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

export default function SpirographMode({ audioContext, params }) {
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
      angle: 0,
      points: [],
      maxPoints: 20000,
      baseR1: 0,
      baseR2: 0,
      baseD: 0,
      R1: 0,
      R2: 0,
      d: 0,
      lastX: null,
      lastY: null,
      rotationSpeed: 0.02,
      smoothBass: 0,
      smoothMid: 0,
      smoothHigh: 0,
      centerX: size.width / 2,
      centerY: size.height / 2,
      init() {
        this.clear()
        const s = Math.min(this.width, this.height) * 0.35
        this.baseR1 = s
        this.baseR2 = s * 0.4
        this.baseD = s * 0.25
        this.centerX = this.width / 2
        this.centerY = this.height / 2
      },
      clear() {
        this.points = []
        this.angle = 0
        this.lastX = null
        this.lastY = null
        this.smoothBass = 0
        this.smoothMid = 0
        this.smoothHigh = 0
        this.ctx.fillStyle = 'rgb(10, 10, 10)'
        this.ctx.fillRect(0, 0, this.width, this.height)
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
      clearBackground(opacity = 1) {
        const p = tunerParams || { decay: 0.5 }
        const decay = p.decay || 0.5
        let effectiveOpacity = opacity * (1 - decay * 0.95)
        this.ctx.fillStyle = `rgba(10, 10, 10, ${effectiveOpacity})`
        this.ctx.fillRect(0, 0, this.width, this.height)
      },
      update(audioFeatures, beatInfo) {
        const weighted = this.getWeightedAudio(audioFeatures)
        const { bass, mid, high, amplitude, centroid } = weighted
        const { normalizedTempo, onBeat, beatIntensity } = beatInfo

        const smoothing = 0.15
        this.smoothBass += (bass - this.smoothBass) * smoothing
        this.smoothMid += (mid - this.smoothMid) * smoothing
        this.smoothHigh += (high - this.smoothHigh) * smoothing

        this.R1 = this.baseR1 * (0.6 + this.smoothBass * 0.8)
        this.R2 = this.baseR2 * (0.5 + this.smoothMid * 1.0)
        this.d = this.baseD * (0.3 + this.smoothHigh * 1.4)

        const p = tunerParams || { chaos: 0.5, sensitivity: 0.5 }
        this.rotationSpeed = (0.015 + normalizedTempo * 0.03) * (0.7 + p.chaos * 0.6)

        const beatThreshold = 0.7 - p.sensitivity * 0.4
        if (onBeat && beatIntensity > beatThreshold) {
          this.angle += beatIntensity * (0.2 + p.chaos * 0.3)
        }

        const R = this.R1
        const r = this.R2
        const d = this.d
        const t = this.angle

        const ratio = r > 0.01 ? (R - r) / r : 0

        const x = this.centerX + (R - r) * Math.cos(t) + d * Math.cos(ratio * t)
        const y = this.centerY + (R - r) * Math.sin(t) - d * Math.sin(ratio * t)

        const color = pitchTempoToColor(centroid, normalizedTempo, amplitude)

        this.points.push({ x, y, color, amplitude })

        if (this.points.length > this.maxPoints) {
          this.points.shift()
        }

        this.angle += this.rotationSpeed
        this.lastX = x
        this.lastY = y
      },
      draw() {
        this.clearBackground(0.03)

        if (this.points.length < 2) return

        const ctx = this.ctx

        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const drawStart = Math.max(0, this.points.length - 5000)

        for (let i = drawStart + 1; i < this.points.length; i++) {
          const p0 = this.points[i - 1]
          const p1 = this.points[i]

          const lineWidth = 0.5 + p1.amplitude * 2.5

          ctx.beginPath()
          ctx.strokeStyle = p1.color.getStyle ? p1.color.getStyle() : p1.color.toString()
          ctx.lineWidth = lineWidth
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }

        if (this.points.length > 0) {
          const current = this.points[this.points.length - 1]
          const gradient = ctx.createRadialGradient(
            current.x, current.y, 0,
            current.x, current.y, 15 + current.amplitude * 20
          )
          gradient.addColorStop(0, current.color.getStyle ? current.color.getStyle() : current.color.toString())
          gradient.addColorStop(1, 'transparent')

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(current.x, current.y, 15 + current.amplitude * 20, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    modeRef.current.init()

    return () => {
      if (modeRef.current) {
        modeRef.current.clear()
      }
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
