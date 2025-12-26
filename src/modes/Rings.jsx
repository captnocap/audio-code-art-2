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

export default function RingsMode({ audioContext, params }) {
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
      rings: [],
      centerX: size.width / 2,
      centerY: size.height / 2,
      maxRadius: 0,
      init() {
        this.centerX = this.width / 2
        this.centerY = this.height / 2
        this.maxRadius = Math.sqrt(this.width * this.width + this.height * this.height) / 2
        this.rings = []
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
        const { amplitude, centroid, bass, mid, high } = weighted
        const { onBeat, beatIntensity, normalizedTempo, isSaturated } = beatInfo
        const p = tunerParams || { sensitivity: 0.5 }

        if (onBeat) {
          this.rings.push({
            radius: 10,
            speed: 3 + beatIntensity * 5 + normalizedTempo * 3,
            thickness: 3 + beatIntensity * 10,
            rgb: pitchTempoToRGB(centroid, normalizedTempo, amplitude),
            color: pitchTempoToColor(centroid, normalizedTempo, amplitude),
            alpha: 0.9,
            birth: Date.now()
          })
        }

        const spawnRate = amplitude * (0.4 + p.sensitivity * 0.6)
        const ringCount = isSaturated ? 3 : (amplitude > (0.7 - p.sensitivity * 0.4) ? 2 : 1)

        for (let i = 0; i < ringCount; i++) {
          if (Math.random() < spawnRate) {
            const freqSource = i === 0 ? centroid : (i === 1 ? bass * 0.3 : high * 0.7 + 0.3)
            this.rings.push({
              radius: 5 + Math.random() * 10,
              speed: 1.5 + amplitude * 4 + Math.random() * 2,
              thickness: 0.5 + amplitude * 4,
              rgb: pitchTempoToRGB(freqSource, normalizedTempo, amplitude),
              color: pitchTempoToColor(freqSource, normalizedTempo, amplitude),
              alpha: 0.2 + amplitude * 0.5,
              birth: Date.now()
            })
          }
        }

        if (isSaturated && Math.random() < 0.5) {
          this.rings.push({
            radius: 3,
            speed: 2 + Math.random() * 3,
            thickness: 1 + Math.random() * 2,
            rgb: pitchTempoToRGB(centroid, normalizedTempo, 0.7),
            alpha: 0.4,
            birth: Date.now()
          })
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
          const ring = this.rings[i]
          ring.radius += ring.speed
          ring.alpha *= 0.995

          if (ring.radius > this.maxRadius || ring.alpha < 0.01) {
            this.rings.splice(i, 1)
          }
        }
      },
      draw() {
        this.clearBackground(0.03)

        for (const ring of this.rings) {
          this.ctx.beginPath()
          this.ctx.arc(this.centerX, this.centerY, ring.radius, 0, Math.PI * 2)
          this.ctx.strokeStyle = `rgba(${ring.rgb.r}, ${ring.rgb.g}, ${ring.rgb.b}, ${ring.alpha})`
          this.ctx.lineWidth = ring.thickness
          this.ctx.stroke()
        }
      },
      clear() {
        this.ctx.fillStyle = '#0a0a0a'
        this.ctx.fillRect(0, 0, this.width, this.height)
        this.rings = []
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
