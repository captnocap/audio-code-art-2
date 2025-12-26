// Mod Matrix - routes audio signals to shader uniforms

export class ModMatrix {
  constructor() {
    this.routes = []
    this.curves = {
      linear: (x) => x,
      exponential: (x) => x * x,
      logarithmic: (x) => Math.log(x + 1) / Math.log(2),
      smoothstep: (x) => x * x * (3 - 2 * x),
      inverse: (x) => 1 - x,
      square: (x) => x * x,
      sqrt: (x) => Math.sqrt(x)
    }
  }

  // Add a modulation route
  addRoute(source, destination, amount = 1.0, curve = 'linear') {
    // Check if route already exists
    const existing = this.routes.findIndex(
      r => r.source === source && r.destination === destination
    )

    if (existing >= 0) {
      // Update existing route
      this.routes[existing] = { source, destination, amount, curve }
    } else {
      // Add new route
      this.routes.push({ source, destination, amount, curve })
    }
  }

  // Remove a route
  removeRoute(source, destination) {
    this.routes = this.routes.filter(
      r => !(r.source === source && r.destination === destination)
    )
  }

  // Update route amount
  setRouteAmount(source, destination, amount) {
    const route = this.routes.find(
      r => r.source === source && r.destination === destination
    )
    if (route) {
      route.amount = amount
    }
  }

  // Set route curve
  setRouteCurve(source, destination, curve) {
    const route = this.routes.find(
      r => r.source === source && r.destination === destination
    )
    if (route && this.curves[curve]) {
      route.curve = curve
    }
  }

  // Get all routes for a destination
  getRoutesForDestination(destination) {
    return this.routes.filter(r => r.destination === destination)
  }

  // Apply modulation to a base value
  apply(destination, baseValue, audioContext) {
    const routes = this.getRoutesForDestination(destination)
    let modulated = baseValue

    for (const route of routes) {
      const sourceValue = audioContext[route.source] || 0
      const curveFn = this.curves[route.curve] || this.curves.linear
      const curvedValue = curveFn(Math.max(0, Math.min(1, sourceValue)))
      modulated += curvedValue * route.amount
    }

    return modulated
  }

  // Get total modulation for a destination (without base value)
  getModulation(destination, audioContext) {
    return this.apply(destination, 0, audioContext)
  }

  // Export routes as JSON
  toJSON() {
    return this.routes
  }

  // Import routes from JSON
  fromJSON(data) {
    this.routes = data.map(r => ({
      source: r.source,
      destination: r.destination,
      amount: r.amount,
      curve: r.curve || 'linear'
    }))
  }

  // Clear all routes
  clear() {
    this.routes = []
  }
}

// Singleton instance
export const modMatrix = new ModMatrix()
