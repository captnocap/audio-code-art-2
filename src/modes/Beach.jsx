import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioStore } from '../stores/audioStore'
import { useTunerStore } from '../stores/tunerStore'

export default function BeachMode({ audioContext, params }) {
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
      shoreline: size.height * 0.3,
      maxTide: size.height * 0.7,
      waveSources: [],
      maxWaveSources: 5,
      waterLevel: new Float32Array(size.width),
      waterVelocity: new Float32Array(size.width),
      waterOpacity: new Float32Array(size.width),
      sedimentLayers: [],
      maxSedimentLayers: 20,
      currentSediment: new Float32Array(size.width),
      shells: [],
      maxShells: 200,
      tidePools: [],
      maxTidePools: 30,
      sustainedEnergy: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothHigh: 0,
      smoothLeft: 0,
      smoothRight: 0,
      smoothAmplitude: 0,
      time: 0,
      init() {
        for (let x = 0; x < this.width; x++) {
          this.waterLevel[x] = this.shoreline
          this.waterOpacity[x] = 0
        }
        this.generateBaseSediment()
        for (let i = 0; i < 50; i++) {
          this.spawnShell(Math.random() * this.width, this.shoreline + Math.random() * 100)
        }
      },
      generateBaseSediment() {
        for (let x = 0; x < this.width; x++) {
          this.currentSediment[x] = Math.sin(x * 0.05) * 5 + Math.sin(x * 0.02) * 10
        }
      },
      spawnWaveSource(x, angle, intensity, stereoSide) {
        if (this.waveSources.length >= this.maxWaveSources) {
          this.waveSources.shift()
        }
        this.waveSources.push({
          x, angle, intensity, stereoSide,
          progress: 0,
          width: 50 + Math.random() * 100,
          speed: 0.5 + intensity * 0.5,
          foam: [],
          birth: this.time
        })
      },
      spawnShell(x, y) {
        if (this.shells.length >= this.maxShells) return
        const types = ['spiral', 'clam', 'starfish', 'pebble', 'seaweed']
        this.shells.push({
          x, y,
          type: types[Math.floor(Math.random() * types.length)],
          size: 3 + Math.random() * 8,
          rotation: Math.random() * Math.PI * 2,
          color: `hsl(${30 + Math.random() * 30}, ${40 + Math.random() * 20}%, ${60 + Math.random() * 20}%)`,
          deposited: this.time,
          driftX: 0, driftY: 0
        })
      },
      spawnTidePool(x, y, size) {
        if (this.tidePools.length >= this.maxTidePools) {
          this.tidePools.shift()
        }
        this.tidePools.push({ x, y, size, depth: 0.5 + Math.random() * 0.5, life: 1, ripples: [], contents: [] })
      },
      saveSedimentLayer() {
        if (this.sedimentLayers.length >= this.maxSedimentLayers) {
          this.sedimentLayers.shift()
        }
        this.sedimentLayers.push({
          pattern: new Float32Array(this.currentSediment),
          time: this.time,
          color: `hsla(40, ${30 + Math.random() * 20}%, ${50 + Math.random() * 15}%, 0.3)`
        })
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
        const { bass, mid, high, amplitude, leftChannel, rightChannel, centroid } = weighted
        const { onBeat, beatIntensity, normalizedTempo, bpm } = beatInfo
        const p = tunerParams || { chaos: 0.5 }

        this.time += 0.016

        const smoothing = 0.1
        this.smoothBass += (bass - this.smoothBass) * smoothing
        this.smoothMid += (mid - this.smoothMid) * smoothing
        this.smoothHigh += (high - this.smoothHigh) * smoothing
        this.smoothAmplitude += (amplitude - this.smoothAmplitude) * smoothing

        const left = leftChannel !== undefined ? leftChannel : amplitude * (0.5 + (Math.random() - 0.5) * 0.3)
        const right = rightChannel !== undefined ? rightChannel : amplitude * (0.5 + (Math.random() - 0.5) * 0.3)
        this.smoothLeft += (left - this.smoothLeft) * smoothing
        this.smoothRight += (right - this.smoothRight) * smoothing

        this.sustainedEnergy = this.sustainedEnergy * 0.99 + amplitude * 0.01

        if (onBeat && beatIntensity > 0.2) {
          const stereoBalance = this.smoothLeft - this.smoothRight
          let angle, stereoSide
          if (Math.abs(stereoBalance) < 0.1) {
            angle = Math.PI / 2
            stereoSide = 'center'
          } else if (stereoBalance > 0) {
            angle = Math.PI / 2 + stereoBalance * Math.PI * 0.3
            stereoSide = 'left'
          } else {
            angle = Math.PI / 2 + stereoBalance * Math.PI * 0.3
            stereoSide = 'right'
          }
          const waveX = this.width * (0.5 - stereoBalance * 0.4)
          this.spawnWaveSource(waveX, angle, beatIntensity, stereoSide)
        }

        for (const wave of this.waveSources) {
          wave.progress += wave.speed * 0.02 * (1 + this.smoothAmplitude)
          const waveReach = this.shoreline + (this.maxTide - this.shoreline) * wave.progress * wave.intensity

          for (let x = 0; x < this.width; x++) {
            const dx = x - wave.x
            const waveInfluence = Math.exp(-(dx * dx) / (wave.width * wave.width * 2))
            const angleOffset = Math.sin(wave.angle) * dx * 0.1
            const waveShape = Math.sin(wave.progress * Math.PI) * waveInfluence

            if (waveShape > 0.1) {
              const targetLevel = waveReach + angleOffset + Math.sin(x * 0.1 + this.time * 2) * 5
              const currentLevel = this.waterLevel[x]
              const force = (targetLevel - currentLevel) * 0.1 * waveShape
              this.waterVelocity[x] += force
              this.waterOpacity[x] = Math.min(1, this.waterOpacity[x] + waveShape * 0.2)
            }
          }

          if (wave.progress < 0.8 && Math.random() < 0.3) {
            wave.foam.push({
              x: wave.x + (Math.random() - 0.5) * wave.width,
              y: waveReach,
              size: 2 + Math.random() * 4,
              life: 1
            })
          }
        }

        for (let x = 0; x < this.width; x++) {
          this.waterLevel[x] += this.waterVelocity[x]
          this.waterVelocity[x] *= 0.95
          const pullBack = (this.waterLevel[x] - this.shoreline) * 0.002
          this.waterVelocity[x] -= pullBack
          this.waterLevel[x] = Math.max(this.shoreline, Math.min(this.maxTide, this.waterLevel[x]))

          if (this.waterLevel[x] < this.shoreline + 10) {
            this.waterOpacity[x] *= 0.98
          } else {
            this.waterOpacity[x] *= 0.995
          }

          if (this.waterLevel[x] > this.shoreline + 5) {
            this.currentSediment[x] += (this.waterLevel[x] - this.shoreline) * 0.001
          }
        }

        if (onBeat && beatIntensity > 0.7) {
          this.saveSedimentLayer()
        }

        if (this.sustainedEnergy > 0.3 && Math.random() < 0.01 * p.chaos) {
          const x = Math.random() * this.width
          const y = this.shoreline + Math.random() * (this.maxTide - this.shoreline) * 0.5
          this.spawnTidePool(x, y, 10 + this.sustainedEnergy * 30)
        }

        for (const pool of this.tidePools) {
          pool.life -= 0.0005
          if (Math.random() < 0.02) {
            pool.ripples.push({ radius: 0, maxRadius: pool.size * 0.8, life: 1 })
          }
          pool.ripples = pool.ripples.filter(r => {
            r.radius += 0.5
            r.life -= 0.02
            return r.life > 0
          })
          if (this.smoothBass > 0.5) {
            pool.ripples.push({ radius: 0, maxRadius: pool.size, life: 0.5 })
          }
        }
        this.tidePools = this.tidePools.filter(p => p.life > 0)
        this.waveSources = this.waveSources.filter(w => w.progress < 1.5)

        for (const wave of this.waveSources) {
          wave.foam = wave.foam.filter(f => {
            f.life -= 0.02
            f.y += (Math.random() - 0.5) * 2
            f.x += (Math.random() - 0.5) * 1
            return f.life > 0
          })
        }

        if (onBeat && beatIntensity > 0.5 && Math.random() < 0.3) {
          let avgTide = 0
          for (let x = 0; x < this.width; x++) {
            avgTide += this.waterLevel[x]
          }
          avgTide /= this.width
          this.spawnShell(Math.random() * this.width, avgTide + (Math.random() - 0.5) * 30)
        }

        for (const shell of this.shells) {
          const xi = Math.floor(shell.x)
          if (xi >= 0 && xi < this.width) {
            if (this.waterLevel[xi] > shell.y - 5) {
              shell.driftX += (Math.random() - 0.5) * 0.5
              shell.driftY += this.waterVelocity[xi] * 0.3
              shell.x += shell.driftX
              shell.y += shell.driftY
              shell.rotation += 0.02
            }
            shell.driftX *= 0.95
            shell.driftY *= 0.95
          }
          shell.y = Math.max(this.shoreline - 20, Math.min(this.maxTide + 50, shell.y))
          shell.x = Math.max(0, Math.min(this.width, shell.x))
        }
      },
      draw() {
        const ctx = this.ctx

        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.shoreline)
        skyGradient.addColorStop(0, '#87ceeb')
        skyGradient.addColorStop(1, '#e0f0ff')
        ctx.fillStyle = skyGradient
        ctx.fillRect(0, 0, this.width, this.shoreline)

        const waterGradient = ctx.createLinearGradient(0, 0, 0, this.shoreline)
        waterGradient.addColorStop(0, '#0a2f4a')
        waterGradient.addColorStop(0.5, '#1a5f7a')
        waterGradient.addColorStop(1, '#2980b9')
        ctx.fillStyle = waterGradient
        ctx.fillRect(0, 0, this.width, this.shoreline)

        const sandGradient = ctx.createLinearGradient(0, this.shoreline, 0, this.height)
        sandGradient.addColorStop(0, '#c9b477')
        sandGradient.addColorStop(0.3, '#e8d5a3')
        sandGradient.addColorStop(1, '#f4e4bc')
        ctx.fillStyle = sandGradient
        ctx.fillRect(0, this.shoreline, this.width, this.height - this.shoreline)

        for (const layer of this.sedimentLayers) {
          ctx.beginPath()
          ctx.moveTo(0, this.height)
          for (let x = 0; x < this.width; x += 3) {
            const sedimentHeight = layer.pattern[x] * 0.5
            ctx.lineTo(x, this.shoreline + sedimentHeight + 50)
          }
          ctx.lineTo(this.width, this.height)
          ctx.closePath()
          ctx.fillStyle = layer.color
          ctx.fill()
        }

        ctx.strokeStyle = 'rgba(180, 160, 120, 0.3)'
        ctx.lineWidth = 1
        for (let y = this.shoreline; y < this.height; y += 15) {
          ctx.beginPath()
          for (let x = 0; x < this.width; x += 2) {
            const ripple = this.currentSediment[x] * 0.3 + Math.sin(x * 0.03 + y * 0.02) * 3
            if (x === 0) ctx.moveTo(x, y + ripple)
            else ctx.lineTo(x, y + ripple)
          }
          ctx.stroke()
        }

        for (const pool of this.tidePools) {
          ctx.beginPath()
          ctx.ellipse(pool.x + 3, pool.y + 3, pool.size, pool.size * 0.6, 0, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
          ctx.fill()

          const poolGradient = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.size)
          poolGradient.addColorStop(0, `rgba(30, 80, 120, ${pool.life * pool.depth})`)
          poolGradient.addColorStop(0.7, `rgba(50, 120, 160, ${pool.life * 0.7})`)
          poolGradient.addColorStop(1, `rgba(80, 140, 180, ${pool.life * 0.3})`)

          ctx.beginPath()
          ctx.ellipse(pool.x, pool.y, pool.size, pool.size * 0.6, 0, 0, Math.PI * 2)
          ctx.fillStyle = poolGradient
          ctx.fill()

          for (const ripple of pool.ripples) {
            ctx.beginPath()
            ctx.ellipse(pool.x, pool.y, ripple.radius, ripple.radius * 0.6, 0, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.life * 0.3})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, this.shoreline)
        for (let x = 0; x < this.width; x += 2) {
          const level = this.waterLevel[x]
          const waveDetail = Math.sin(x * 0.05 + this.time * 3) * 3 + Math.sin(x * 0.02 + this.time * 2) * 5
          ctx.lineTo(x, level + waveDetail)
        }
        ctx.lineTo(this.width, this.shoreline)
        ctx.lineTo(this.width, 0)
        ctx.closePath()

        const waveGradient = ctx.createLinearGradient(0, 0, 0, this.maxTide)
        waveGradient.addColorStop(0, 'rgba(10, 47, 74, 0.95)')
        waveGradient.addColorStop(0.5, 'rgba(41, 128, 185, 0.85)')
        waveGradient.addColorStop(0.8, 'rgba(93, 173, 226, 0.7)')
        waveGradient.addColorStop(1, 'rgba(174, 214, 241, 0.4)')
        ctx.fillStyle = waveGradient
        ctx.fill()

        for (let x = 0; x < this.width; x += 3) {
          const opacity = this.waterOpacity[x]
          if (opacity > 0.05 && this.waterLevel[x] < this.maxTide - 10) {
            const y = this.waterLevel[x]
            const fadeHeight = 30
            const wetGradient = ctx.createLinearGradient(0, y, 0, y + fadeHeight)
            wetGradient.addColorStop(0, `rgba(140, 120, 80, ${opacity * 0.6})`)
            wetGradient.addColorStop(1, 'rgba(140, 120, 80, 0)')
            ctx.fillStyle = wetGradient
            ctx.fillRect(x, y, 4, fadeHeight)
          }
        }

        for (const wave of this.waveSources) {
          for (const foam of wave.foam) {
            ctx.beginPath()
            ctx.arc(foam.x, foam.y, foam.size, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255, 255, 255, ${foam.life * 0.7})`
            ctx.fill()
          }
        }

        for (const wave of this.waveSources) {
          if (wave.progress < 1) {
            const crestY = this.shoreline + (this.maxTide - this.shoreline) * wave.progress * wave.intensity
            ctx.beginPath()
            for (let x = wave.x - wave.width; x < wave.x + wave.width; x += 3) {
              const dx = x - wave.x
              const influence = Math.exp(-(dx * dx) / (wave.width * wave.width))
              const y = crestY + Math.sin(x * 0.2 + this.time * 5) * 3 * influence
              if (x === wave.x - wave.width) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - wave.progress) * 0.6})`
            ctx.lineWidth = 3
            ctx.stroke()
          }
        }

        for (const shell of this.shells) {
          ctx.save()
          ctx.translate(shell.x, shell.y)
          ctx.rotate(shell.rotation)
          ctx.fillStyle = shell.color
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
          ctx.lineWidth = 0.5

          switch (shell.type) {
            case 'spiral':
              ctx.beginPath()
              for (let t = 0; t < Math.PI * 4; t += 0.2) {
                const r = t * shell.size * 0.15
                const x = Math.cos(t) * r
                const y = Math.sin(t) * r
                if (t === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
              }
              ctx.stroke()
              ctx.fill()
              break
            case 'clam':
              ctx.beginPath()
              ctx.ellipse(0, 0, shell.size, shell.size * 0.7, 0, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
              for (let i = 0; i < 5; i++) {
                ctx.beginPath()
                ctx.ellipse(0, 0, shell.size * (0.2 + i * 0.15), shell.size * 0.7 * (0.2 + i * 0.15), 0, 0, Math.PI * 2)
                ctx.stroke()
              }
              break
            case 'starfish':
              ctx.beginPath()
              for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
                const outerX = Math.cos(angle) * shell.size
                const outerY = Math.sin(angle) * shell.size
                const innerAngle = angle + Math.PI / 5
                const innerX = Math.cos(innerAngle) * shell.size * 0.4
                const innerY = Math.sin(innerAngle) * shell.size * 0.4
                if (i === 0) ctx.moveTo(outerX, outerY)
                else ctx.lineTo(outerX, outerY)
                ctx.lineTo(innerX, innerY)
              }
              ctx.closePath()
              ctx.fill()
              ctx.stroke()
              break
            case 'pebble':
              ctx.beginPath()
              ctx.ellipse(0, 0, shell.size, shell.size * 0.7, 0, 0, Math.PI * 2)
              ctx.fill()
              break
            case 'seaweed':
              ctx.strokeStyle = shell.color
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(0, 0)
              for (let t = 0; t < shell.size; t += 2) {
                ctx.lineTo(Math.sin(t * 0.5 + this.time) * 3, -t)
              }
              ctx.stroke()
              break
          }
          ctx.restore()
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.font = '12px monospace'
        ctx.fillText(`L: ${this.smoothLeft.toFixed(2)} | R: ${this.smoothRight.toFixed(2)}`, 10, 20)
        ctx.fillText(`Tide pools: ${this.tidePools.length} | Shells: ${this.shells.length}`, 10, 35)
        ctx.fillText(`Sediment layers: ${this.sedimentLayers.length}`, 10, 50)
      },
      clear() {
        this.waveSources = []
        this.shells = []
        this.tidePools = []
        this.sedimentLayers = []
        this.sustainedEnergy = 0
        for (let x = 0; x < this.width; x++) {
          this.waterLevel[x] = this.shoreline
          this.waterOpacity[x] = 0
          this.waterVelocity[x] = 0
        }
        this.generateBaseSediment()
      },
      resize(width, height) {
        this.width = width
        this.height = height
        this.shoreline = height * 0.3
        this.maxTide = height * 0.7
        this.waterLevel = new Float32Array(width)
        this.waterVelocity = new Float32Array(width)
        this.waterOpacity = new Float32Array(width)
        this.currentSediment = new Float32Array(width)
        this.init()
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
