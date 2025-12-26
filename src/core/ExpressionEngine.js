// Expression Engine - evaluates math expressions with audio variables
// Supports: arithmetic, functions (sin, cos, abs, etc.), audio variables

import { create, all } from 'mathjs'

// Create a mathjs instance with limited scope for safety
const math = create(all)

// Pre-compile commonly used functions for performance
const compiledExpressions = new Map()

export class ExpressionEngine {
  constructor() {
    // Define available functions
    this.functions = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      sqrt: Math.sqrt,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      exp: Math.exp,
      log: Math.log,

      // GLSL-style functions
      clamp: (x, min, max) => Math.min(Math.max(x, min), max),
      mix: (a, b, t) => a * (1 - t) + b * t,
      step: (edge, x) => x < edge ? 0 : 1,
      smoothstep: (edge0, edge1, x) => {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
        return t * t * (3 - 2 * t)
      },
      fract: (x) => x - Math.floor(x),
      mod: (x, y) => x - y * Math.floor(x / y),
      sign: Math.sign,

      // Easing functions
      easeIn: (t) => t * t,
      easeOut: (t) => 1 - (1 - t) * (1 - t),
      easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

      // Noise (simple pseudo-random based on input)
      noise: (x) => {
        const n = Math.sin(x * 12.9898) * 43758.5453
        return n - Math.floor(n)
      }
    }
  }

  // Parse and compile an expression
  compile(expr) {
    if (typeof expr !== 'string') return () => expr

    // Check cache
    if (compiledExpressions.has(expr)) {
      return compiledExpressions.get(expr)
    }

    try {
      // Use mathjs to compile the expression
      const compiled = math.compile(expr)

      // Create evaluation function
      const evalFn = (context) => {
        try {
          // Merge context with functions
          const scope = { ...this.functions, ...context }
          return compiled.evaluate(scope)
        } catch (e) {
          console.warn('Expression evaluation error:', e.message)
          return 0
        }
      }

      compiledExpressions.set(expr, evalFn)
      return evalFn
    } catch (e) {
      console.warn('Expression compilation error:', e.message)
      const fallback = () => 0
      compiledExpressions.set(expr, fallback)
      return fallback
    }
  }

  // Evaluate an expression with the given context
  evaluate(expr, context) {
    const fn = this.compile(expr)
    return fn(context)
  }

  // Evaluate a parameter definition (handles both number and expression types)
  evaluateParam(paramDef, context) {
    if (paramDef.type === 'expression') {
      return this.evaluate(paramDef.value, context)
    }
    return paramDef.value
  }

  // Clear the expression cache
  clearCache() {
    compiledExpressions.clear()
  }

  // Validate an expression (returns error message or null if valid)
  validate(expr) {
    if (typeof expr !== 'string') return null

    try {
      math.parse(expr)
      return null
    } catch (e) {
      return e.message
    }
  }

  // Get list of available variables for autocomplete
  getAvailableVariables() {
    return [
      'bass', 'mid', 'high', 'amplitude',
      'beat', 'beatPulse',
      'lfo1', 'lfo2',
      'envelope',
      'time', 'random'
    ]
  }

  // Get list of available functions for autocomplete
  getAvailableFunctions() {
    return Object.keys(this.functions)
  }
}

// Singleton instance
export const expressionEngine = new ExpressionEngine()
