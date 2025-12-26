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

export default function AudiosurfMode({ audioContext, params }) {
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
      trackWidth: 400,
      laneCount: 3,
      laneWidth: 133,
      trackSegments: [],
      maxSegments: 100,
      segmentLength: 40,
      player: { lane: 1, targetLane: 1, x: 0, tilt: 0, trail: [] },
      orbs: [],
      maxOrbs: 50,
      score: 0,
      combo: 0,
      maxCombo: 0,
      collected: 0,
      speed: 5,
      baseSpeed: 5,
      cameraHeight: 150,
      cameraDistance: 300,
      horizonY: 0,
      playerY: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothHigh: 0,
      smoothAmplitude: 0,
      currentHue: 0,
      waveformHistory: [],
      particles: [],
      streaks: [],
      keyHandler: null,
      init() {
        this.trackSegments = []
        this.orbs = []
        this.score = 0
        this.combo = 0
        this.maxCombo = 0
        this.collected = 0
        this.waveformHistory = []
        this.particles = []
        this.streaks = []
        this.player.lane = 1
        this.player.targetLane = 1
        this.player.trail = []
        this.playerY = this.height - 180
        this.horizonY = this.height * 0.28
        for (let i = 0; i < this.maxSegments; i++) {
          this.trackSegments.push({ z: i * this.segmentLength, height: 0, curve: 0, hue: 200 })
        }
      },
      setupInput() {
        this.keyHandler = (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            this.player.targetLane = Math.max(0, this.player.targetLane - 1)
          }
          if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            this.player.targetLane = Math.min(this.laneCount - 1, this.player.targetLane + 1)
          }
        }
        window.addEventListener('keydown', this.keyHandler)
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
      spawnOrb(intensity, pitch) {
        if (this.orbs.length >= this.maxOrbs) return
        const lane = Math.floor(Math.random() * this.laneCount)
        const z = this.trackSegments[this.trackSegments.length - 1]?.z || 1000
        let type = 'normal'
        if (intensity > 0.8) type = 'gold'
        else if (intensity > 0.5) type = 'silver'
        this.orbs.push({ lane, z, type, hue: pitch * 360, collected: false, scale: 1 })
      },
      collectOrb(orb) {
        this.collected++
        this.combo++
        this.maxCombo = Math.max(this.maxCombo, this.combo)
        let points = 100
        if (orb.type === 'gold') points = 500
        else if (orb.type === 'silver') points = 250
        points *= (1 + this.combo * 0.1)
        this.score += Math.floor(points)
        const centerX = this.width / 2
        const orbX = centerX + (orb.lane - 1) * this.laneWidth * 0.8
        const orbY = this.playerY - 20
        for (let i = 0; i < 15; i++) {
          this.particles.push({
            x: orbX, y: orbY,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            life: 1, hue: orb.hue, size: 3 + Math.random() * 5
          })
        }
      },
      spawnStreak() {
        if (Math.random() > 0.3) return
        const side = Math.random() < 0.5 ? -1 : 1
        this.streaks.push({
          x: this.width / 2 + side * (200 + Math.random() * 200),
          y: this.horizonY + Math.random() * 100,
          length: 50 + Math.random() * 100,
          speed: this.speed * 2,
          alpha: 0.5 + Math.random() * 0.5
        })
      },
      update(audioFeatures, beatInfo) {
        const weighted = this.getWeightedAudio(audioFeatures)
        const { amplitude, centroid, bass, mid, high, waveform } = weighted
        const { onBeat, beatIntensity, normalizedTempo } = beatInfo
        const smoothing = 0.15
        this.smoothBass += (bass - this.smoothBass) * smoothing
        this.smoothMid += (mid - this.smoothMid) * smoothing
        this.smoothHigh += (high - this.smoothHigh) * smoothing
        this.smoothAmplitude += (amplitude - this.smoothAmplitude) * smoothing
        this.currentHue = centroid * 360
        this.speed = this.baseSpeed + normalizedTempo * 8 + this.smoothAmplitude * 5
        const avgWaveform = waveform ? waveform.reduce((a, b) => a + b, 0) / waveform.length : 0
        this.waveformHistory.push(avgWaveform)
        if (this.waveformHistory.length > 100) this.waveformHistory.shift()
        for (const seg of this.trackSegments) seg.z -= this.speed
        while (this.trackSegments.length > 0 && this.trackSegments[0].z < -this.segmentLength) {
          this.trackSegments.shift()
        }
        while (this.trackSegments.length < this.maxSegments) {
          const lastZ = this.trackSegments.length > 0 ? this.trackSegments[this.trackSegments.length - 1].z : 0
          const height = this.smoothAmplitude * 100 + Math.sin(Date.now() * 0.002) * 20
          const curve = Math.sin(Date.now() * 0.001) * this.smoothMid * 100
          this.trackSegments.push({ z: lastZ + this.segmentLength, height, curve, hue: this.currentHue })
        }
        this.player.lane += (this.player.targetLane - this.player.lane) * 0.2
        this.player.tilt = (this.player.targetLane - this.player.lane) * 0.5
        const centerX = this.width / 2
        this.player.x = centerX + (this.player.lane - 1) * this.laneWidth * 0.8
        this.player.trail.push({ x: this.player.x, y: this.playerY })
        if (this.player.trail.length > 20) this.player.trail.shift()
        if (onBeat && beatIntensity > 0.3) this.spawnOrb(beatIntensity, centroid)
        if (this.smoothHigh > 0.5 && Math.random() < 0.1) this.spawnOrb(0.5, centroid)
        this.orbs = this.orbs.filter(orb => {
          orb.z -= this.speed
          orb.scale = 1 + Math.sin(Date.now() * 0.01 + orb.z * 0.1) * 0.2
          return orb.z > -100
        })
        const playerZ = 50
        for (const orb of this.orbs) {
          if (orb.collected) continue
          if (Math.abs(orb.z - playerZ) < this.segmentLength) {
            const orbLane = orb.lane
            const playerLane = Math.round(this.player.lane)
            if (orbLane === playerLane) {
              orb.collected = true
              this.collectOrb(orb)
            }
          }
        }
        this.particles = this.particles.filter(p => {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.3
          p.life -= 0.03
          return p.life > 0
        })
        if (this.speed > 10) this.spawnStreak()
        this.streaks = this.streaks.filter(s => {
          s.y += s.speed
          s.alpha -= 0.02
          return s.y < this.height && s.alpha > 0
        })
      },
      project(x, y, z) {
        const scale = this.cameraDistance / (z + this.cameraDistance)
        return {
          x: this.width / 2 + x * scale,
          y: this.horizonY + (this.height - this.horizonY - y) * scale,
          scale
        }
      },
      draw() {
        const ctx = this.ctx
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.horizonY)
        skyGradient.addColorStop(0, `hsl(${(this.currentHue + 180) % 360}, 30%, 10%)`)
        skyGradient.addColorStop(1, `hsl(${this.currentHue}, 50%, 20%)`)
        ctx.fillStyle = skyGradient
        ctx.fillRect(0, 0, this.width, this.horizonY)
        ctx.fillStyle = `hsl(${this.currentHue}, 20%, 8%)`
        ctx.fillRect(0, this.horizonY, this.width, this.height - this.horizonY)
        for (const streak of this.streaks) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${streak.alpha})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(streak.x, streak.y)
          ctx.lineTo(streak.x, streak.y + streak.length)
          ctx.stroke()
        }
        const centerX = this.width / 2
        for (let i = this.trackSegments.length - 1; i >= 1; i--) {
          const seg = this.trackSegments[i]
          const prevSeg = this.trackSegments[i - 1]
          if (seg.z < 0) continue
          const proj = this.project(0, seg.height, seg.z)
          const prevProj = this.project(0, prevSeg.height, prevSeg.z)
          if (proj.scale <= 0 || prevProj.scale <= 0) continue
          const width = this.trackWidth * proj.scale
          const prevWidth = this.trackWidth * prevProj.scale
          const x = centerX + seg.curve * proj.scale
          const prevX = centerX + prevSeg.curve * prevProj.scale
          const alpha = Math.min(1, proj.scale * 2)
          const hue = seg.hue
          ctx.beginPath()
          ctx.moveTo(prevX - prevWidth / 2, prevProj.y)
          ctx.lineTo(prevX + prevWidth / 2, prevProj.y)
          ctx.lineTo(x + width / 2, proj.y)
          ctx.lineTo(x - width / 2, proj.y)
          ctx.closePath()
          const gradient = ctx.createLinearGradient(x - width/2, proj.y, x + width/2, proj.y)
          gradient.addColorStop(0, `hsla(${hue}, 60%, 20%, ${alpha})`)
          gradient.addColorStop(0.5, `hsla(${hue}, 60%, 30%, ${alpha})`)
          gradient.addColorStop(1, `hsla(${hue}, 60%, 20%, ${alpha})`)
          ctx.fillStyle = gradient
          ctx.fill()
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`
          ctx.lineWidth = 1
          for (let lane = 1; lane < this.laneCount; lane++) {
            const laneX = x - width/2 + (width / this.laneCount) * lane
            const prevLaneX = prevX - prevWidth/2 + (prevWidth / this.laneCount) * lane
            ctx.beginPath()
            ctx.moveTo(prevLaneX, prevProj.y)
            ctx.lineTo(laneX, proj.y)
            ctx.stroke()
          }
          ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha * 0.5})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(prevX - prevWidth / 2, prevProj.y)
          ctx.lineTo(x - width / 2, proj.y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(prevX + prevWidth / 2, prevProj.y)
          ctx.lineTo(x + width / 2, proj.y)
          ctx.stroke()
        }
        for (const orb of this.orbs) {
          if (orb.collected || orb.z < 0) continue
          const proj = this.project(0, 30, orb.z)
          if (proj.scale <= 0) continue
          const laneOffset = (orb.lane - 1) * this.laneWidth * 0.8
          const x = centerX + laneOffset * proj.scale
          const y = proj.y - 20 * proj.scale
          const size = 20 * proj.scale * orb.scale
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2)
          if (orb.type === 'gold') {
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)')
            gradient.addColorStop(0.5, 'rgba(255, 180, 0, 0.4)')
            gradient.addColorStop(1, 'rgba(255, 150, 0, 0)')
          } else if (orb.type === 'silver') {
            gradient.addColorStop(0, 'rgba(200, 200, 255, 0.8)')
            gradient.addColorStop(0.5, 'rgba(150, 150, 200, 0.4)')
            gradient.addColorStop(1, 'rgba(100, 100, 150, 0)')
          } else {
            gradient.addColorStop(0, `hsla(${orb.hue}, 80%, 60%, 0.8)`)
            gradient.addColorStop(0.5, `hsla(${orb.hue}, 80%, 40%, 0.4)`)
            gradient.addColorStop(1, `hsla(${orb.hue}, 80%, 30%, 0)`)
          }
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, size * 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = orb.type === 'gold' ? '#ffd700' : orb.type === 'silver' ? '#c0c0ff' : `hsl(${orb.hue}, 80%, 70%)`
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
        }
        const x = this.player.x
        const y = this.playerY
        ctx.beginPath()
        for (let i = 0; i < this.player.trail.length; i++) {
          const t = this.player.trail[i]
          const alpha = i / this.player.trail.length
          if (i === 0) ctx.moveTo(t.x, t.y)
          else ctx.lineTo(t.x, t.y)
        }
        ctx.strokeStyle = `rgba(100, 200, 255, 0.3)`
        ctx.lineWidth = 10
        ctx.stroke()
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 60)
        glowGradient.addColorStop(0, 'rgba(100, 200, 255, 0.5)')
        glowGradient.addColorStop(0.5, 'rgba(50, 150, 255, 0.2)')
        glowGradient.addColorStop(1, 'rgba(0, 100, 255, 0)')
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(x, y, 60, 0, Math.PI * 2)
        ctx.fill()
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(this.player.tilt)
        ctx.fillStyle = '#4af'
        ctx.beginPath()
        ctx.moveTo(0, -25)
        ctx.lineTo(20, 15)
        ctx.lineTo(0, 5)
        ctx.lineTo(-20, 15)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(0, -5, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(255, 150, 50, ${0.5 + this.smoothAmplitude * 0.5})`
        ctx.beginPath()
        ctx.arc(0, 15, 5 + this.smoothAmplitude * 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        for (const p of this.particles) {
          ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 32px "SF Mono", Monaco, monospace'
        ctx.fillText(this.score.toLocaleString(), 30, 50)
        if (this.combo > 1) {
          ctx.fillStyle = `hsl(${this.currentHue}, 80%, 60%)`
          ctx.font = 'bold 24px "SF Mono", Monaco, monospace'
          ctx.fillText(`${this.combo}x COMBO`, 30, 85)
        }
        ctx.fillStyle = '#888'
        ctx.font = '14px "SF Mono", Monaco, monospace'
        ctx.fillText(`Speed: ${this.speed.toFixed(1)}`, this.width - 120, 30)
        ctx.fillText(`Orbs: ${this.collected}`, this.width - 120, 50)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '12px "SF Mono", Monaco, monospace'
        ctx.fillText('← → or A/D to move', 30, this.height - 20)
      },
      clear() {
        this.init()
      },
      dispose() {
        if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler)
      }
    }

    modeRef.current.setupInput()
    modeRef.current.init()

    return () => {
      if (modeRef.current) modeRef.current.dispose()
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
