// Simplex noise implementation for flow fields
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256)
    this.perm = new Uint8Array(512)
    this.permMod12 = new Uint8Array(512)

    // Initialize permutation array
    for (let i = 0; i < 256; i++) {
      this.p[i] = i
    }

    // Shuffle using seed
    let n = seed * 256
    for (let i = 255; i > 0; i--) {
      n = (n * 16807) % 2147483647
      const j = Math.floor((n / 2147483647) * (i + 1))
      ;[this.p[i], this.p[j]] = [this.p[j], this.p[i]]
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255]
      this.permMod12[i] = this.perm[i] % 12
    }
  }

  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1)
    const G2 = (3 - Math.sqrt(3)) / 6

    const grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ]

    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)

    const t = (i + j) * G2
    const X0 = i - t
    const Y0 = j - t
    const x0 = x - X0
    const y0 = y - Y0

    let i1, j1
    if (x0 > y0) {
      i1 = 1
      j1 = 0
    } else {
      i1 = 0
      j1 = 1
    }

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255

    const gi0 = this.permMod12[ii + this.perm[jj]]
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]]
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]]

    let n0 = 0, n1 = 0, n2 = 0

    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0)
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1)
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2)
    }

    return 70 * (n0 + n1 + n2)
  }
}

export class FlowField {
  constructor(width, height, resolution = 20) {
    this.width = width
    this.height = height
    this.resolution = resolution
    this.cols = Math.ceil(width / resolution)
    this.rows = Math.ceil(height / resolution)
    this.field = new Array(this.cols * this.rows)
    this.noise = new SimplexNoise()
    this.time = 0
    this.noiseScale = 0.005
    this.timeScale = 0.0005
  }

  update(audioFeatures) {
    const { bass, mid, high, amplitude } = audioFeatures

    // Audio modulates flow field parameters
    const turbulence = 0.5 + high * 2  // High frequencies add turbulence
    const strength = 0.5 + bass * 2    // Bass adds strength/speed
    const rotation = mid * Math.PI     // Mid frequencies rotate the field

    this.time += this.timeScale * (1 + amplitude * 3)

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = x + y * this.cols

        // Multi-octave noise for more interesting patterns
        let angle = 0
        let amp = 1
        let freq = this.noiseScale

        for (let octave = 0; octave < 3; octave++) {
          const noiseVal = this.noise.noise2D(
            x * freq * turbulence,
            y * freq * turbulence + this.time
          )
          angle += noiseVal * amp
          amp *= 0.5
          freq *= 2
        }

        angle = angle * Math.PI * 2 + rotation

        this.field[idx] = {
          angle,
          strength: strength * (0.5 + Math.abs(this.noise.noise2D(x * 0.01, y * 0.01)))
        }
      }
    }
  }

  getVector(x, y) {
    const col = Math.floor(x / this.resolution)
    const row = Math.floor(y / this.resolution)

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return { x: 0, y: 0 }
    }

    const idx = col + row * this.cols
    const { angle, strength } = this.field[idx]

    return {
      x: Math.cos(angle) * strength,
      y: Math.sin(angle) * strength
    }
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.cols = Math.ceil(width / this.resolution)
    this.rows = Math.ceil(height / this.resolution)
    this.field = new Array(this.cols * this.rows)
  }
}
