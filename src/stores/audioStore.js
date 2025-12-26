import { create } from 'zustand'
import { AudioPipeline } from '../core/AudioPipeline'
import { useTunerStore } from './tunerStore'

const AUDIO_SOURCE_KEY = 'audio-canvas-source'

const getSavedSource = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(AUDIO_SOURCE_KEY)
    if (saved === 'mic' || saved === 'tab') return saved
  }
  return 'tab'
}

export const useAudioStore = create((set, get) => ({
  // Audio state
  isInitialized: false,
  audioSource: getSavedSource(),
  pipeline: null,

  // Set audio source preference
  setAudioSource: (source) => {
    if (source === 'tab' || source === 'mic') {
      set({ audioSource: source })
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUDIO_SOURCE_KEY, source)
      }
    }
  },

  // Initialize audio
  initialize: async (mode = null) => {
    const source = mode || get().audioSource

    const pipeline = new AudioPipeline()
    await pipeline.init()

    let success = false
    if (source === 'mic') {
      success = await pipeline.startMicrophone()
    } else {
      success = await pipeline.startTabCapture()
    }

    if (!success) {
      throw new Error('Audio capture was cancelled or denied')
    }

    set({ pipeline, isInitialized: true, audioSource: source })
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDIO_SOURCE_KEY, source)
    }
  },

  // Resume audio context when tab becomes visible
  resumeIfNeeded: async () => {
    const { pipeline, isInitialized } = get()
    if (pipeline && isInitialized && pipeline.audioContext) {
      if (pipeline.audioContext.state === 'suspended') {
        await pipeline.audioContext.resume()
      }
    }
  },

  // Method to get fresh audio data (called by components in useFrame)
  getAudioData: () => {
    const { pipeline, isInitialized } = get()

    // Helper to ensure finite numbers
    const safe = (val) => (typeof val === 'number' && isFinite(val)) ? val : 0

    // Default safe values when no audio
    if (!pipeline || !isInitialized) {
      const defaults = {
        bass: 0, mid: 0, high: 0, amplitude: 0,
        beat: 0, beatPulse: 0, lfo1: 0, lfo2: 0,
        envelope: 0, centroid: 0, dominantFrequency: 0,
        frequencies: new Uint8Array(0)
      }

      return {
        ...defaults,
        features: { ...defaults, frequencies: defaults.frequencies },
        beatInfo: { onBeat: false, beatIntensity: 0, normalizedTempo: 0.5, isSaturated: false, tempo: 120 }
      }
    }

    // Get tuner params and pass to pipeline
    const tunerParams = useTunerStore.getState().getAll()
    pipeline.setTuner(tunerParams)

    const raw = pipeline.analyze() || {}

    // Get the raw frequency data from the pipeline's analyzer
    const frequencies = pipeline.frequencyData || new Uint8Array(0)

    // Build safe audio data with fallbacks
    const audioData = {
      bass: safe(raw.bass),
      mid: safe(raw.mid),
      high: safe(raw.high),
      amplitude: safe(raw.amplitude),
      beat: safe(raw.beat),
      beatPulse: safe(raw.beatPulse),
      lfo1: safe(raw.lfo1),
      lfo2: safe(raw.lfo2),
      envelope: safe(raw.envelope),
      centroid: safe(raw.mid),
      dominantFrequency: safe(raw.mid) * 1000,
      frequencies: frequencies  // Raw frequency array for spectrum visualization
    }

    return {
      ...audioData,
      features: {
        bass: audioData.bass,
        mid: audioData.mid,
        high: audioData.high,
        amplitude: audioData.amplitude,
        centroid: audioData.centroid,
        dominantFrequency: audioData.dominantFrequency,
        frequencies: audioData.frequencies  // Include in features too
      },
      beatInfo: {
        onBeat: audioData.beat > 0.5,
        beatIntensity: audioData.beat,
        normalizedTempo: 0.5,
        isSaturated: audioData.amplitude > 0.8,
        tempo: 120,
      }
    }
  }
}))
