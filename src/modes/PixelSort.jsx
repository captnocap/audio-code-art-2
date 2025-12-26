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

export default function PixelSortMode({ audioContext, params }) {
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
      sortThreshold: 0.4,
      sortIntensity: 0,
      lastBeat: 0,
      colorBands: [],
      generateBaseBands() {
        this.colorBands = []
        const bandHeight = 2
        for (let y = 0; y < this.height; y += bandHeight) {
          this.colorBands.push({ y, height: bandHeight, hue: (y / this.height) * 360, brightness: 0.1, sorted: false })
        }
      },
      init() {
        this.ctx.fillStyle = '#0a0a0a'
        this.ctx.fillRect(0, 0, this.width, this.height)
        this.generateBaseBands()
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
        const { amplitude, bass, high, centroid } = weighted
        const { onBeat, normalizedTempo, beatIntensity } = beatInfo
        const p = tunerParams || { sensitivity: 0.5 }
        this.sortThreshold = 0.6 - p.sensitivity * 0.4
        const frequencies = audioFeatures.frequencies
        const bandCount = this.colorBands.length
        const freqPerBand = Math.floor(frequencies.length / bandCount)
        for (let i = 0; i < bandCount; i++) {
          const band = this.colorBands[i]
          const freqIdx = Math.min(i * freqPerBand, frequencies.length - 1)
          const magnitude = frequencies[freqIdx] / 255
          const pitch = i / bandCount
          band.rgb = pitchTempoToRGB(pitch, normalizedTempo, magnitude)
          band.brightness = magnitude
          band.active = magnitude > 0.1
        }
        this.sortIntensity = 0
        if (amplitude > this.sortThreshold) {
          this.sortIntensity = (amplitude - this.sortThreshold) / (1 - this.sortThreshold)
        }
        if (onBeat) this.sortIntensity = Math.max(this.sortIntensity, beatIntensity)
      },
      applyPixelSort(intensity) {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height)
        const data = imageData.data
        const columnsToSort = Math.floor(this.width * intensity * 0.3)
        for (let c = 0; c < columnsToSort; c++) {
          const x = Math.floor(Math.random() * this.width)
          this.sortColumn(data, x, intensity)
        }
        this.ctx.putImageData(imageData, 0, 0)
      },
      sortColumn(data, x, intensity) {
        const column = []
        for (let y = 0; y < this.height; y++) {
          const idx = (y * this.width + x) * 4
          column.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3], brightness: (data[idx] + data[idx + 1] + data[idx + 2]) / 3 })
        }
        const threshold = 30
        let spanStart = 0
        for (let i = 1; i <= column.length; i++) {
          const prev = column[i - 1]
          const curr = column[i]
          if (!curr || Math.abs(curr.brightness - prev.brightness) > threshold) {
            const spanLength = i - spanStart
            if (spanLength > 5 && spanLength < this.height * 0.5) {
              const span = column.slice(spanStart, i)
              span.sort((a, b) => a.brightness - b.brightness)
              for (let j = 0; j < span.length; j++) column[spanStart + j] = span[j]
            }
            spanStart = i
          }
        }
        for (let y = 0; y < this.height; y++) {
          const idx = (y * this.width + x) * 4
          const pixel = column[y]
          data[idx] = pixel.r
          data[idx + 1] = pixel.g
          data[idx + 2] = pixel.b
          data[idx + 3] = pixel.a
        }
      },
      draw() {
        for (const band of this.colorBands) {
          if (!band.active || !band.rgb) continue
          this.ctx.fillStyle = `rgba(${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}, 0.3)`
          const offset = (band.brightness - 0.5) * 50
          this.ctx.fillRect(offset, band.y, this.width, band.height)
        }
        const p = tunerParams || { chaos: 0.5 }
        if (this.sortIntensity > 0.1) {
          this.applyPixelSort(this.sortIntensity * (0.5 + p.chaos * 0.5))
        }
        this.clearBackground(0.01)
      },
      clear() {
        this.ctx.fillStyle = '#0a0a0a'
        this.ctx.fillRect(0, 0, this.width, this.height)
        this.generateBaseBands()
      }
    }

    modeRef.current.init()

    return () => { if (modeRef.current) modeRef.current.clear() }
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

  useFrame(() => { if (texture) texture.needsUpdate = true })

  return (
    <mesh scale={[size.width / 100, size.height / 100, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent={true} />
    </mesh>
  )
}
