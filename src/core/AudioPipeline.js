// Audio Pipeline - combines analyzer + beat detection + LFOs
// With decay-based smoothing to prevent rubberbanding

export class AudioPipeline {
  constructor() {
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.mediaStream = null
    this.frequencyData = null
    this.fftSize = 2048

    // Smoothed output values (prevents rubberbanding)
    this.smoothed = {
      bass: 0,
      mid: 0,
      high: 0,
      amplitude: 0
    }

    // Beat detection state
    this.energyHistory = []
    this.historySize = 43
    this.beatThreshold = 1.3
    this.lastBeatTime = 0
    this.beatCooldown = 100
    this.recentBeats = []
    this.bpm = 0
    this.beatIntensity = 0
    this.onBeat = false
    this.beatPulse = 0 // fast-decay for punchy effects

    // Blast beat saturation
    this.saturationEnabled = true
    this.saturationThreshold = 8
    this.isSaturated = false

    // LFO state
    this.lfo1Phase = 0
    this.lfo2Phase = 0
    this.lfo1Freq = 0.5
    this.lfo2Freq = 2.0
    this.lfo1Waveform = 'sine'
    this.lfo2Waveform = 'saw'

    // Envelope follower
    this.envelopeValue = 0
    this.envelopeAttack = 0.1
    this.envelopeRelease = 0.3

    // Time tracking
    this.lastTime = performance.now()

    // Tuner parameters (can be overridden externally)
    this.tuner = {
      decay: 0.7,
      sensitivity: 0.3,
      bassWeight: 0.5,
      midWeight: 0.5,
      highWeight: 0.5
    }
  }

  // Update tuner params from external store
  setTuner(params) {
    this.tuner = { ...this.tuner, ...params }
  }

  async init() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.analyser.smoothingTimeConstant = 0.8

    const bufferLength = this.analyser.frequencyBinCount
    this.frequencyData = new Uint8Array(bufferLength)
  }

  // Start capturing audio from a tab (for YouTube, Spotify, etc.)
  async startTabCapture() {
    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      const audioTracks = this.mediaStream.getAudioTracks()
      if (audioTracks.length === 0) {
        throw new Error('No audio track - check "Share audio" when sharing')
      }

      const audioStream = new MediaStream(audioTracks)
      this.source = this.audioContext.createMediaStreamSource(audioStream)
      this.source.connect(this.analyser)

      return true
    } catch (err) {
      console.error('Tab capture failed:', err)
      return false
    }
  }

  // Start capturing from microphone
  async startMicrophone() {
    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.source.connect(this.analyser)

      return true
    } catch (err) {
      console.error('Microphone access denied:', err)
      return false
    }
  }

  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
  }

  // LFO waveform generators
  lfoWaveform(phase, type) {
    const p = phase % 1
    switch (type) {
      case 'sine':
        return Math.sin(p * Math.PI * 2) * 0.5 + 0.5
      case 'saw':
        return p
      case 'square':
        return p < 0.5 ? 0 : 1
      case 'triangle':
        return Math.abs(p * 2 - 1)
      case 'random':
        return Math.random()
      default:
        return Math.sin(p * Math.PI * 2) * 0.5 + 0.5
    }
  }

  // Main analysis function - returns all audio features
  analyze() {
    const currentTime = performance.now()
    const deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Get frequency data
    this.analyser.getByteFrequencyData(this.frequencyData)
    const frequencies = this.frequencyData
    const binCount = frequencies.length
    const sampleRate = this.audioContext.sampleRate

    // Split into frequency bands
    const bassEnd = Math.floor(250 / (sampleRate / 2) * binCount)
    const midEnd = Math.floor(2000 / (sampleRate / 2) * binCount)
    const highEnd = Math.floor(20000 / (sampleRate / 2) * binCount)

    let bass = 0, mid = 0, high = 0
    let bassCount = 0, midCount = 0, highCount = 0

    for (let i = 0; i < binCount; i++) {
      const value = frequencies[i] / 255

      if (i < bassEnd) {
        bass += value
        bassCount++
      } else if (i < midEnd) {
        mid += value
        midCount++
      } else if (i < highEnd) {
        high += value
        highCount++
      }
    }

    bass = bassCount > 0 ? bass / bassCount : 0
    mid = midCount > 0 ? mid / midCount : 0
    high = highCount > 0 ? high / highCount : 0

    // Overall amplitude
    let amplitude = 0
    for (let i = 0; i < binCount; i++) {
      amplitude += frequencies[i] / 255
    }
    amplitude /= binCount

    // Apply frequency weights from tuner
    const weightedBass = bass * (0.5 + this.tuner.bassWeight)
    const weightedMid = mid * (0.5 + this.tuner.midWeight)
    const weightedHigh = high * (0.5 + this.tuner.highWeight)

    // Apply decay-based smoothing (prevents rubberbanding)
    // Higher decay = slower response = more smoothing
    // decay of 0.7 at 60fps: smoothFactor = 0.7^(1/60) ≈ 0.994, so (1-0.994) = 0.006 per frame
    // We use a time-based approach for frame-rate independence
    const decayFactor = Math.pow(this.tuner.decay, deltaTime * 60) // normalized to 60fps
    const smoothFactor = 1 - decayFactor

    // Apply sensitivity threshold - only react to significant changes
    const sensitivity = this.tuner.sensitivity
    const applySmoothing = (current, target) => {
      const diff = Math.abs(target - current)
      // If change is below sensitivity threshold, decay slowly
      if (diff < sensitivity * 0.1) {
        return current * 0.99 + target * 0.01
      }
      // Otherwise use normal decay-based smoothing
      return current * decayFactor + target * smoothFactor
    }

    this.smoothed.bass = applySmoothing(this.smoothed.bass, weightedBass)
    this.smoothed.mid = applySmoothing(this.smoothed.mid, weightedMid)
    this.smoothed.high = applySmoothing(this.smoothed.high, weightedHigh)
    this.smoothed.amplitude = applySmoothing(this.smoothed.amplitude, amplitude)

    // Beat detection (uses raw values for responsiveness)
    const energy = bass * 0.7 + amplitude * 0.3

    this.energyHistory.push(energy)
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift()
    }

    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const timeSinceLastBeat = currentTime - this.lastBeatTime
    this.onBeat = false

    if (energy > avgEnergy * this.beatThreshold && timeSinceLastBeat > this.beatCooldown) {
      this.onBeat = true
      this.beatIntensity = Math.min((energy / avgEnergy) - 1, 1)
      this.beatPulse = 1.0 // instant spike for fast-decay

      this.recentBeats.push(currentTime)
      this.lastBeatTime = currentTime

      const fiveSecondsAgo = currentTime - 5000
      this.recentBeats = this.recentBeats.filter(t => t > fiveSecondsAgo)

      if (this.recentBeats.length > 2) {
        const intervals = []
        for (let i = 1; i < this.recentBeats.length; i++) {
          intervals.push(this.recentBeats[i] - this.recentBeats[i - 1])
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        this.bpm = 60000 / avgInterval
      }
    }

    // Blast beat saturation
    if (this.saturationEnabled) {
      const beatRate = this.recentBeats.length / 5
      this.isSaturated = beatRate > this.saturationThreshold

      if (this.isSaturated) {
        this.beatIntensity = 0.7
        this.onBeat = false
      }
    }

    // Decay beat intensity
    if (!this.isSaturated) {
      this.beatIntensity *= 0.9
    }

    // Fast decay for beat pulse (for punchy effects)
    this.beatPulse *= 0.85

    // Update LFOs
    this.lfo1Phase += this.lfo1Freq * deltaTime
    this.lfo2Phase += this.lfo2Freq * deltaTime
    const lfo1 = this.lfoWaveform(this.lfo1Phase, this.lfo1Waveform)
    const lfo2 = this.lfoWaveform(this.lfo2Phase, this.lfo2Waveform)

    // Envelope follower
    const targetEnvelope = amplitude
    if (targetEnvelope > this.envelopeValue) {
      this.envelopeValue += (targetEnvelope - this.envelopeValue) * this.envelopeAttack
    } else {
      this.envelopeValue += (targetEnvelope - this.envelopeValue) * this.envelopeRelease
    }

    return {
      // Smoothed values for visuals (prevents rubberbanding)
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      high: this.smoothed.high,
      amplitude: this.smoothed.amplitude,
      // Raw values for beat detection and expressions
      rawBass: bass,
      rawMid: mid,
      rawHigh: high,
      rawAmplitude: amplitude,
      // Beat detection
      beat: this.beatIntensity,
      beatPulse: this.beatPulse,
      onBeat: this.onBeat,
      bpm: this.bpm,
      isSaturated: this.isSaturated,
      // Modulation
      lfo1,
      lfo2,
      envelope: this.envelopeValue
    }
  }

  // Configure LFO settings
  setLFO(id, settings) {
    if (id === 1 || id === 'lfo1') {
      if (settings.frequency !== undefined) this.lfo1Freq = settings.frequency
      if (settings.waveform !== undefined) this.lfo1Waveform = settings.waveform
    } else if (id === 2 || id === 'lfo2') {
      if (settings.frequency !== undefined) this.lfo2Freq = settings.frequency
      if (settings.waveform !== undefined) this.lfo2Waveform = settings.waveform
    }
  }
}
