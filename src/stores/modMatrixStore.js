import { create } from 'zustand'

// Available sources (audio signals)
const sources = [
  { id: 'bass', name: 'Bass', color: '#ef4444' },
  { id: 'mid', name: 'Mid', color: '#eab308' },
  { id: 'high', name: 'High', color: '#22c55e' },
  { id: 'amplitude', name: 'Amplitude', color: '#3b82f6' },
  { id: 'beat', name: 'Beat', color: '#a855f7' },
  { id: 'beatPulse', name: 'Beat Pulse', color: '#ec4899' },
  { id: 'lfo1', name: 'LFO 1', color: '#06b6d4' },
  { id: 'lfo2', name: 'LFO 2', color: '#14b8a6' },
  { id: 'envelope', name: 'Envelope', color: '#f97316' }
]

// Curve types for modulation
const curves = [
  { id: 'linear', name: 'Linear' },
  { id: 'exponential', name: 'Exponential' },
  { id: 'smoothstep', name: 'Smoothstep' },
  { id: 'inverse', name: 'Inverse' }
]

export const useModMatrixStore = create((set, get) => ({
  // Available sources
  sources,

  // Curve types
  curves,

  // Routes: source -> destination with amount
  routes: [],

  // LFO settings
  lfoSettings: {
    lfo1: { frequency: 0.5, waveform: 'sine' },
    lfo2: { frequency: 2.0, waveform: 'saw' }
  },

  // Add a route
  addRoute: (source, destination, amount = 1.0, curve = 'linear') => {
    const { routes } = get()
    // Check if route already exists
    const existing = routes.find(r => r.source === source && r.destination === destination)
    if (existing) {
      // Update existing route
      set({
        routes: routes.map(r =>
          r.source === source && r.destination === destination
            ? { ...r, amount, curve }
            : r
        )
      })
    } else {
      // Add new route
      set({
        routes: [...routes, { source, destination, amount, curve }]
      })
    }
  },

  // Remove a route
  removeRoute: (source, destination) => {
    const { routes } = get()
    set({
      routes: routes.filter(r => !(r.source === source && r.destination === destination))
    })
  },

  // Update route amount
  setRouteAmount: (source, destination, amount) => {
    const { routes } = get()
    set({
      routes: routes.map(r =>
        r.source === source && r.destination === destination
          ? { ...r, amount }
          : r
      )
    })
  },

  // Get routes for a specific destination
  getRoutesForDestination: (destination) => {
    const { routes } = get()
    return routes.filter(r => r.destination === destination)
  },

  // Apply modulation to a value
  applyModulation: (destination, baseValue, audioContext) => {
    const { routes, curves: curveTypes } = get()
    const destinationRoutes = routes.filter(r => r.destination === destination)

    let modulated = baseValue
    for (const route of destinationRoutes) {
      const sourceValue = audioContext[route.source] || 0
      let amount = route.amount

      // Apply curve
      let curvedValue = sourceValue
      switch (route.curve) {
        case 'exponential':
          curvedValue = Math.pow(sourceValue, 2)
          break
        case 'smoothstep':
          curvedValue = sourceValue * sourceValue * (3 - 2 * sourceValue)
          break
        case 'inverse':
          curvedValue = 1 - sourceValue
          break
        default: // linear
          curvedValue = sourceValue
      }

      modulated += curvedValue * amount
    }

    return modulated
  },

  // Update LFO settings
  setLFOSettings: (lfoId, settings) => {
    const { lfoSettings } = get()
    set({
      lfoSettings: {
        ...lfoSettings,
        [lfoId]: { ...lfoSettings[lfoId], ...settings }
      }
    })
  }
}))
