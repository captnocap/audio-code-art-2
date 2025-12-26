import { create } from 'zustand'

// Only working JSX mode definitions
// orbitControls: true = user can pan/zoom, false = mode controls camera
const modeDefinitions = {
  neuralDreams: {
    name: 'Neural Dreams',
    description: 'NCA + warp streaks + beat explosions',
    component: 'NeuralDreams',
    orbitControls: false, // Mode controls camera (tunnel fly-through)
    params: {
      warpIntensity: { type: 'number', default: 1.0, min: 0, max: 5, step: 0.1 },
      ncaDecay: { type: 'number', default: 0.95, min: 0.8, max: 0.99, step: 0.01 },
      streakLength: { type: 'number', default: 0.5, min: 0, max: 2, step: 0.1 },
      beatExplosionRadius: { type: 'expression', default: '0.5 + beat * 2.0' },
      colorShift: { type: 'number', default: 0, min: 0, max: 1, step: 0.01 },
      glowIntensity: { type: 'expression', default: '0.5 + bass * 0.5' }
    }
  },
  wormholeNative: {
    name: 'Wormhole Surfer',
    description: 'Fly through audio-reactive tunnel with surfer player',
    component: 'WormholeNative',
    orbitControls: false, // Mode controls camera
    params: {}
  },
  wormhole: {
    name: 'Wormhole',
    description: 'Tunnel with ring patterns',
    component: 'Wormhole',
    orbitControls: false, // Mode controls camera
    params: {
      tunnelSpeed: { type: 'expression', default: '1.0 + bass * 2.0' },
      ringFrequency: { type: 'number', default: 8, min: 2, max: 20, step: 1 },
      ringThickness: { type: 'number', default: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      colorShift: { type: 'expression', default: 'time * 0.1 + mid * 0.5' },
      distortion: { type: 'expression', default: '0.2 + high * 0.3' }
    }
  },
  psychedelic: {
    name: 'Psychedelic',
    description: 'Vertex twist + noise displacement + cosine palette',
    component: 'Psychedelic',
    orbitControls: true,
    params: {
      twistAmount: { type: 'expression', default: '0.5 + bass * 1.5' },
      noiseScale: { type: 'number', default: 2.0, min: 0.5, max: 10, step: 0.5 },
      noiseSpeed: { type: 'expression', default: '0.5 + mid * 0.5' },
      fresnelPower: { type: 'number', default: 2.0, min: 0.5, max: 5, step: 0.5 },
      colorCycle: { type: 'expression', default: 'time * 0.2' }
    }
  },
  spirograph: {
    name: 'Spirograph',
    description: 'Audio-modulated mathematical curves creating unique song fingerprints',
    component: 'Spirograph',
    orbitControls: false,
    params: {
      chaos: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
      sensitivity: { type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05 }
    }
  },
  rings: {
    name: 'Rings',
    description: 'Concentric rings pulse outward on beats',
    component: 'Rings',
    orbitControls: false,
    params: {
      sensitivity: { type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05 }
    }
  },
  beach: {
    name: 'Beach',
    description: 'Sound as ocean tides. Sand remembers wave patterns.',
    component: 'Beach',
    orbitControls: false,
    params: {
      chaos: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 }
    }
  },
  mandala: {
    name: 'Mandala',
    description: 'Radial slices on each beat build a mandala timeline like tree rings',
    component: 'Mandala',
    orbitControls: false,
    params: {
      chaos: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 }
    }
  },
  flowParticles: {
    name: 'Flow Particles',
    description: 'Particles following audio-reactive flow fields with stipple accumulation',
    component: 'FlowParticles',
    orbitControls: false,
    params: {}
  },
  audiosurf: {
    name: 'Audiosurf',
    description: 'Ride a highway generated from audio. Collect orbs, feel the flow.',
    component: 'Audiosurf',
    orbitControls: false,
    params: {}
  },
  mirror: {
    name: 'Mirror',
    description: 'Kaleidoscope with radial symmetry',
    component: 'Mirror',
    orbitControls: false,
    params: {}
  },
  cymatics: {
    name: 'Cymatics',
    description: 'Chladni plate standing wave patterns',
    component: 'Cymatics',
    orbitControls: false,
    params: {}
  },
  voronoi: {
    name: 'Voronoi',
    description: 'Cellular patterns that fracture on beats',
    component: 'Voronoi',
    orbitControls: false,
    params: {
      chaos: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
      sensitivity: { type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05 }
    }
  },
  pixelSort: {
    name: 'Pixel Sort',
    description: 'Pixel sorting creates glitchy smears when amplitude crosses threshold',
    component: 'PixelSort',
    orbitControls: false,
    params: {
      chaos: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
      sensitivity: { type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05 }
    }
  },
  bspGallery: {
    name: 'BSP Gallery',
    description: 'Explore GoldSrc maps (CS 1.6, Half-Life) with a fly camera',
    component: 'BSPGallery',
    orbitControls: false, // Uses custom fly camera
    category: 'experimental',
    params: {}
  }
}

const STORAGE_KEY = 'audio-canvas-mode'
const STORAGE_KEY_PARAMS = 'audio-canvas-params'

// Load saved mode or default
const savedMode = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
const initialMode = savedMode && modeDefinitions[savedMode] ? savedMode : 'neuralDreams'

// Load saved params
let savedParams = {}
try {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_PARAMS)
    if (saved) savedParams = JSON.parse(saved)
  }
} catch (e) {
  console.warn('Failed to load saved params:', e)
}

export const useModeStore = create((set, get) => ({
  // Current mode - load from localStorage or default
  currentMode: initialMode,

  // All mode definitions
  modes: modeDefinitions,

  // Current parameter values (overrides defaults) - load from localStorage
  paramValues: savedParams,

  // Switch mode
  setMode: (modeId) => {
    if (modeDefinitions[modeId]) {
      set({ currentMode: modeId })
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, modeId)
      }
    }
  },

  // Save params to localStorage
  saveParams: () => {
    const { paramValues } = get()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(paramValues))
    }
  },

  // Get current mode definition
  getCurrentMode: () => {
    const { currentMode, modes } = get()
    return modes[currentMode]
  },

  // Get all available mode IDs
  getModeIds: () => Object.keys(modeDefinitions),

  // Get parameter value (with fallback to default)
  getParamValue: (paramName) => {
    const { currentMode, modes, paramValues } = get()
    const modeParams = modes[currentMode]?.params
    if (!modeParams || !modeParams[paramName]) return 0

    const key = `${currentMode}.${paramName}`
    if (paramValues[key] !== undefined) {
      return paramValues[key]
    }
    return modeParams[paramName].default
  },

  // Set parameter value
  setParamValue: (paramName, value) => {
    const { currentMode, paramValues } = get()
    const key = `${currentMode}.${paramName}`
    const newValues = { ...paramValues, [key]: value }
    set({ paramValues: newValues })

    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(newValues))
      } catch (e) {
        // Ignore storage errors
      }
    }
  },

  // Get all current params with their values
  getCurrentParams: () => {
    const { currentMode, modes, paramValues } = get()
    const modeParams = modes[currentMode]?.params || {}
    const result = {}

    for (const [name, def] of Object.entries(modeParams)) {
      const key = `${currentMode}.${name}`
      result[name] = {
        ...def,
        value: paramValues[key] !== undefined ? paramValues[key] : def.default
      }
    }

    return result
  }
}))
