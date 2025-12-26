import { create } from 'zustand'

// Effect definitions
const effectDefinitions = {
  feedback: {
    name: 'Feedback',
    description: 'Temporal accumulation with decay',
    uniforms: {
      amount: { type: 'expression', default: '0.92 + beat * 0.05' },
      decay: { type: 'number', default: 0.98, min: 0.9, max: 0.999, step: 0.001 },
      zoom: { type: 'expression', default: '1.0 + bass * 0.02' },
      rotation: { type: 'expression', default: 'mid * 0.02' }
    }
  },
  bloom: {
    name: 'Bloom',
    description: 'Glow effect',
    uniforms: {
      threshold: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
      intensity: { type: 'expression', default: '1.0 + beat * 0.5' },
      radius: { type: 'number', default: 0.5, min: 0.1, max: 2, step: 0.1 }
    }
  },
  rgbSplit: {
    name: 'RGB Split',
    description: 'Chromatic aberration',
    uniforms: {
      amount: { type: 'expression', default: '0.005 + beat * 0.02' },
      angle: { type: 'expression', default: 'time' }
    }
  },
  pixelMelt: {
    name: 'Pixel Melt',
    description: 'Datamosh-style displacement',
    uniforms: {
      intensity: { type: 'expression', default: '0.1 + bass * 0.3' },
      blockSize: { type: 'number', default: 8, min: 2, max: 32, step: 2 },
      noiseScale: { type: 'number', default: 2.0, min: 0.5, max: 10, step: 0.5 }
    }
  },
  opticalFlow: {
    name: 'Optical Flow',
    description: 'Motion-based warping',
    uniforms: {
      strength: { type: 'expression', default: '0.5 + amplitude * 1.0' },
      decay: { type: 'number', default: 0.95, min: 0.8, max: 0.99, step: 0.01 }
    }
  }
}

export const useFXStore = create((set, get) => ({
  // Effect chain (order matters)
  chain: [
    { id: 'feedback', enabled: true },
    { id: 'bloom', enabled: false },
    { id: 'rgbSplit', enabled: false }
  ],

  // Effect definitions
  effects: effectDefinitions,

  // Uniform overrides
  uniformValues: {},

  // Toggle effect enabled
  toggleEffect: (effectId) => {
    const { chain } = get()
    set({
      chain: chain.map(fx =>
        fx.id === effectId ? { ...fx, enabled: !fx.enabled } : fx
      )
    })
  },

  // Reorder effects
  reorderEffects: (fromIndex, toIndex) => {
    const { chain } = get()
    const newChain = [...chain]
    const [removed] = newChain.splice(fromIndex, 1)
    newChain.splice(toIndex, 0, removed)
    set({ chain: newChain })
  },

  // Add effect to chain
  addEffect: (effectId) => {
    const { chain, effects } = get()
    if (!effects[effectId]) return
    if (chain.find(fx => fx.id === effectId)) return

    set({
      chain: [...chain, { id: effectId, enabled: true }]
    })
  },

  // Remove effect from chain
  removeEffect: (effectId) => {
    const { chain } = get()
    set({
      chain: chain.filter(fx => fx.id !== effectId)
    })
  },

  // Get uniform value
  getUniformValue: (effectId, uniformName) => {
    const { effects, uniformValues } = get()
    const effectDef = effects[effectId]
    if (!effectDef || !effectDef.uniforms[uniformName]) return 0

    const key = `${effectId}.${uniformName}`
    if (uniformValues[key] !== undefined) {
      return uniformValues[key]
    }
    return effectDef.uniforms[uniformName].default
  },

  // Set uniform value
  setUniformValue: (effectId, uniformName, value) => {
    const { uniformValues } = get()
    const key = `${effectId}.${uniformName}`
    set({
      uniformValues: { ...uniformValues, [key]: value }
    })
  },

  // Get all enabled effects with their uniform values
  getEnabledEffects: () => {
    const { chain, effects, uniformValues } = get()
    return chain
      .filter(fx => fx.enabled)
      .map(fx => {
        const effectDef = effects[fx.id]
        const uniforms = {}

        for (const [name, def] of Object.entries(effectDef.uniforms)) {
          const key = `${fx.id}.${name}`
          uniforms[name] = {
            ...def,
            value: uniformValues[key] !== undefined ? uniformValues[key] : def.default
          }
        }

        return {
          id: fx.id,
          name: effectDef.name,
          uniforms
        }
      })
  }
}))
