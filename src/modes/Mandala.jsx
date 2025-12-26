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

export default function MandalaMode({ audioContext, params }) {
  const { size } = useThree()
  const canvasRef = useRef(null)
  const textureRef = useRef(null)
  const modeRef = useRef(null)

  const getAudioData = useAudioStore(s => s.getAudioData)
  const tunerParams = useTunerStore(s => s.params)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    canvasRef.current = canvas

    if (textureRef.current) {
      textureRef.current.dispose()
    }

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.colorSpace = THREE.SRGBColorSpace
    textureRef.current = tex

    modeRef.current = {
      ctx: ctx,
      width: size.width,
      height: size.height,
      slices: [],
      currentRadius: 50,
      maxRadius: 0,
      rotationOffset: 0,
      centerX: size.width / 2,
      centerY: size.height / 2,
      init() {
        this.centerX = this.width / 2
        this.centerY = this.height / 2
        this.maxRadius = Math.min(this.width, this.height) * 0.45
        this.currentRadius = 50
        this.slices = []
        this.rotationOffset = 0
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
        if (!this.ctx) return
        const p = tunerParams || { decay: 0.5 }
        const decay = p.decay || 0.5
        let effectiveOpacity = opacity * (1 - decay * 0.95)
        effectiveOpacity = Math.max(0.01, Math.min(1, effectiveOpacity))
        this.ctx.fillStyle = `rgba(10, 10, 10, ${effectiveOpacity})`
        this.ctx.fillRect(0, 0, this.width, this.height)
      },
      update(audioFeatures, beatInfo) {
        const weighted = this.getWeightedAudio(audioFeatures)
        const { amplitude, centroid, bass, mid, high } = weighted
        const { onBeat, beatIntensity, normalizedTempo } = beatInfo
        const p = tunerParams || { chaos: 0.5 }

        this.rotationOffset += 0.001 * (1 + normalizedTempo) * (0.5 + p.chaos)

        if (onBeat && this.currentRadius < this.maxRadius) {
          const sliceCount = Math.floor(8 + beatIntensity * 8)
          const sliceAngle = (Math.PI * 2) / sliceCount

          for (let i = 0; i < sliceCount; i++) {
            const angle = i * sliceAngle + this.rotationOffset
            const freqMix = (i % 3 === 0) ? bass : (i % 3 === 1) ? mid : high
            const pitch = centroid + (Math.random() - 0.5) * 0.2

            this.slices.push({
              angle,
              startRadius: this.currentRadius,
              endRadius: this.currentRadius + 5 + beatIntensity * 15,
              width: sliceAngle * 0.8,
              color: pitchTempoToColor(pitch, normalizedTempo, freqMix),
              rgb: pitchTempoToRGB(pitch, normalizedTempo, freqMix),
              intensity: freqMix,
              birth: Date.now()
            })
          }

          this.currentRadius += 3 + beatIntensity * 10
        }

        if (amplitude > 0.2 && Math.random() < amplitude * 0.3) {
          const angle = Math.random() * Math.PI * 2
          const pitch = centroid
          const rgb = pitchTempoToRGB(pitch, normalizedTempo, amplitude)

          this.slices.push({
            angle,
            startRadius: Math.max(10, this.currentRadius - 5),
            endRadius: Math.max(this.currentRadius, this.currentRadius + amplitude * 10),
            width: 0.05 + amplitude * 0.1,
            color: pitchTempoToColor(pitch, normalizedTempo, amplitude),
            rgb,
            intensity: amplitude,
            birth: Date.now()
          })
        }
      },
      draw() {
        if (!this.ctx) return
        this.clearBackground(0.005)

        const now = Date.now()
        const maxAge = 10000

        this.slices = this.slices.filter(slice =>
          slice.endRadius < this.maxRadius * 1.5 &&
          now - slice.birth < maxAge
        )

        for (const slice of this.slices) {
          const { angle, startRadius, endRadius, width, rgb, intensity } = slice

          this.ctx.save()
          this.ctx.translate(this.centerX, this.centerY)

          this.ctx.beginPath()
          this.ctx.arc(0, 0, startRadius, angle - width / 2, angle + width / 2)

          this.ctx.beginPath()
          this.ctx.arc(0, 0, startRadius, angle - width / 2, angle + width / 2)
          this.ctx.arc(0, 0, endRadius, angle + width / 2, angle - width / 2, true)
          this.ctx.closePath()

          const gradient = this.ctx.createRadialGradient(0, 0, startRadius, 0, 0, endRadius)
          const r = Math.max(0, Math.min(255, rgb.r))
          const g = Math.max(0, Math.min(255, rgb.g))
          const b = Math.max(0, Math.min(255, rgb.b))
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, intensity * 0.8))})`)
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, intensity * 0.3))})`)

          this.ctx.fillStyle = gradient
          this.ctx.fill()

          this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.2})`
          this.ctx.lineWidth = 0.5
          this.ctx.stroke()

          this.ctx.restore()
        }
      },
      clear() {
        if (this.ctx) {
          this.ctx.fillStyle = '#0a0a0a'
          this.ctx.fillRect(0, 0, this.width, this.height)
        }
        this.slices = []
        this.currentRadius = 50
        this.rotationOffset = 0
      }
    }

    modeRef.current.init()

    return () => {
      if (modeRef.current) modeRef.current.clear()
      if (textureRef.current) textureRef.current.dispose()
    }
  }, [size.width, size.height])

  useFrame(() => {
    if (!modeRef.current) return
    const audioData = getAudioData()
    modeRef.current.update(audioData.features, audioData.beatInfo)
    modeRef.current.draw()
  })

  useFrame(() => {
    if (textureRef.current) textureRef.current.needsUpdate = true
  })

  return (
    <mesh scale={[size.width / 100, size.height / 100, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={textureRef.current} transparent={true} />
    </mesh>
  )
}
