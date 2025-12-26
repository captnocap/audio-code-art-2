// Tuner Store - Global visualization parameters like audio-canvas
// Controls how audio signals are smoothed and weighted

import { create } from 'zustand'

export const useTunerStore = create((set, get) => ({
  // Core parameters
  decay: 0.7,             // How fast things fade (0 = instant, 1 = forever)
  sensitivity: 0.3,       // Audio reactivity threshold (lower = more reactive)
  feedback: 0.1,          // Self-reference amount

  // Frequency weights
  bassWeight: 0.5,        // Bass influence (0-1)
  midWeight: 0.5,         // Mid influence (0-1)
  highWeight: 0.5,        // High influence (0-1)

  // Advanced
  chaos: 0.1,             // Randomness factor
  colorDrift: 0.1,        // Hue shift over time

  // Presets
  presets: {
    subtle: {
      decay: 0.85,
      sensitivity: 0.2,
      feedback: 0.05,
      bassWeight: 0.4,
      midWeight: 0.5,
      highWeight: 0.4,
      chaos: 0.05,
      colorDrift: 0.05
    },
    balanced: {
      decay: 0.7,
      sensitivity: 0.3,
      feedback: 0.1,
      bassWeight: 0.5,
      midWeight: 0.5,
      highWeight: 0.5,
      chaos: 0.1,
      colorDrift: 0.1
    },
    aggressive: {
      decay: 0.4,
      sensitivity: 0.6,
      feedback: 0.3,
      bassWeight: 0.8,
      midWeight: 0.6,
      highWeight: 0.9,
      chaos: 0.3,
      colorDrift: 0.3
    },
    chaos: {
      decay: 0.2,
      sensitivity: 0.9,
      feedback: 0.6,
      bassWeight: 1.0,
      midWeight: 1.0,
      highWeight: 1.0,
      chaos: 0.7,
      colorDrift: 0.5
    }
  },

  // Actions
  setParam: (key, value) => set({ [key]: value }),

  applyPreset: (presetName) => {
    const preset = get().presets[presetName]
    if (preset) {
      set({ ...preset })
    }
  },

  getAll: () => {
    const state = get()
    return {
      decay: state.decay,
      sensitivity: state.sensitivity,
      feedback: state.feedback,
      bassWeight: state.bassWeight,
      midWeight: state.midWeight,
      highWeight: state.highWeight,
      chaos: state.chaos,
      colorDrift: state.colorDrift
    }
  }
}))
