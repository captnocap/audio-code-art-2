import * as THREE from 'three'

export class FrameRecorder {
  constructor() {
    this.frames = []
    this.isRecording = false
    this.startTime = 0
    this.frameIndex = 0
  }

  start() {
    this.frames = []
    this.isRecording = true
    this.startTime = performance.now()
    this.frameIndex = 0
  }

  stop() {
    this.isRecording = false
    return this.frames
  }

  captureFrame(gl, audioContext, mode, params, modeState = null) {
    if (!this.isRecording) return

    const timestamp = performance.now() - this.startTime

    const frameData = {
      index: this.frameIndex++,
      timestamp,
      audioData: {
        bass: audioContext.bass ?? 0,
        mid: audioContext.mid ?? 0,
        high: audioContext.high ?? 0,
        amplitude: audioContext.amplitude ?? 0,
        beat: audioContext.beat ?? 0,
        beatPulse: audioContext.beatPulse ?? 0,
        lfo1: audioContext.lfo1 ?? 0,
        lfo2: audioContext.lfo2 ?? 0,
        envelope: audioContext.envelope ?? 0
      },
      mode,
      params: { ...params },
      modeState: modeState ? this.serializeModeState(modeState) : null
    }

    this.frames.push(frameData)
    return frameData
  }

  serializeModeState(state) {
    if (!state) return null

    const serialized = {}

    for (const [key, value] of Object.entries(state)) {
      if (value === null || value === undefined) {
        serialized[key] = null
      } else if (value instanceof THREE.WebGLRenderTarget) {
        serialized[key] = this.serializeRenderTarget(value)
      } else if (value instanceof THREE.Texture) {
        serialized[key] = this.serializeTexture(value)
      } else if (Array.isArray(value)) {
        serialized[key] = value.map(v =>
          v instanceof THREE.WebGLRenderTarget ? this.serializeRenderTarget(v) : v
        )
      } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        serialized[key] = value
      } else if (typeof value === 'object') {
        serialized[key] = this.serializeModeState(value)
      }
    }

    return serialized
  }

  serializeRenderTarget(target) {
    if (!target.texture || !target.texture.image) return null

    try {
      const image = target.texture.image
      const width = image.width || 256
      const height = image.height || 256

      if (image.data instanceof Float32Array) {
        return {
          type: 'float32',
          width,
          height,
          data: Array.from(image.data)
        }
      } else if (image.data instanceof Uint8Array) {
        return {
          type: 'uint8',
          width,
          height,
          data: Array.from(image.data)
        }
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (target.texture.format === THREE.RGBAFormat) {
          const imageData = ctx.createImageData(width, height)
          const gl = target.texture.__webglTexture
          if (gl) {
            try {
              const pixels = new Uint8Array(width * height * 4)
              gl.bindTexture(gl.TEXTURE_2D, gl)
              gl.getTexImage(gl.TEXTURE_2D, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
              imageData.data.set(pixels)
              ctx.putImageData(imageData, 0, 0)
            } catch (e) {
              return { type: 'placeholder', width, height }
            }
          }
          return {
            type: 'canvas',
            width,
            height,
            dataUrl: canvas.toDataURL('image/png')
          }
        }

        return { type: 'placeholder', width, height }
      }
    } catch (e) {
      return { type: 'error', message: e.message }
    }
  }

  serializeTexture(texture) {
    return this.serializeRenderTarget({
      texture,
      textue: texture
    })
  }

  deserializeModeState(serialized, gl) {
    if (!serialized) return null

    const deserialized = {}

    for (const [key, value] of Object.entries(serialized)) {
      if (value === null || value.type === null) {
        deserialized[key] = null
      } else if (value && typeof value === 'object') {
        if (value.type === 'float32') {
          const data = new Float32Array(value.data)
          const texture = new THREE.DataTexture(
            data,
            value.width,
            value.height,
            THREE.RGBAFormat,
            THREE.FloatType
          )
          texture.needsUpdate = true
          deserialized[key] = texture
        } else if (value.type === 'uint8') {
          const data = new Uint8Array(value.data)
          const texture = new THREE.DataTexture(
            data,
            value.width,
            value.height,
            THREE.RGBAFormat
          )
          texture.needsUpdate = true
          deserialized[key] = texture
        } else if (value.type === 'canvas') {
          const img = new Image()
          img.src = value.dataUrl
          const texture = new THREE.Texture(img)
          img.onload = () => texture.needsUpdate = true
          deserialized[key] = texture
        } else if (value.type === 'placeholder') {
          const texture = new THREE.DataTexture(
            new Float32Array(value.width * value.height * 4),
            value.width,
            value.height,
            THREE.RGBAFormat,
            THREE.FloatType
          )
          texture.needsUpdate = true
          deserialized[key] = texture
        } else if (value.type === 'error') {
          deserialized[key] = null
        } else {
          deserialized[key] = this.deserializeModeState(value, gl)
        }
      } else {
        deserialized[key] = value
      }
    }

    return deserialized
  }

  createRenderTargetFromData(data, gl) {
    if (!data || data.type === 'placeholder' || data.type === 'error') {
      const size = data?.width || 256
      const target = new THREE.WebGLRenderTarget(size, size, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType
      })
      return target
    }

    if (data.type === 'float32' || data.type === 'uint8') {
      const target = new THREE.WebGLRenderTarget(data.width, data.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: data.type === 'float32' ? THREE.FloatType : THREE.UnsignedByteType
      })

      const texture = new THREE.DataTexture(
        data.type === 'float32' ? new Float32Array(data.data) : new Uint8Array(data.data),
        data.width,
        data.height,
        THREE.RGBAFormat,
        data.type === 'float32' ? THREE.FloatType : THREE.UnsignedByteType
      )
      texture.needsUpdate = true

      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: texture })
      )
      const scene = new THREE.Scene()
      scene.add(quad)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      gl.setRenderTarget(target)
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      return target
    }

    if (data.type === 'canvas') {
      const img = new Image()
      img.src = data.dataUrl
      const texture = new THREE.Texture(img)
      img.onload = () => texture.needsUpdate = true

      const target = new THREE.WebGLRenderTarget(data.width, data.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      })

      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: texture })
      )
      const scene = new THREE.Scene()
      scene.add(quad)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      img.onload = () => {
        gl.setRenderTarget(target)
        gl.render(scene, camera)
        gl.setRenderTarget(null)
      }

      return target
    }

    return null
  }

  getFrame(index) {
    if (index < 0 || index >= this.frames.length) return null
    return this.frames[index]
  }

  getFrameAtTime(time) {
    for (let i = 0; i < this.frames.length; i++) {
      if (this.frames[i].timestamp >= time) {
        return this.frames[i]
      }
    }
    return this.frames[this.frames.length - 1] || null
  }

  getTotalDuration() {
    if (this.frames.length === 0) return 0
    return this.frames[this.frames.length - 1].timestamp - this.frames[0].timestamp
  }

  getFrameCount() {
    return this.frames.length
  }

  getUsedMemory() {
    let total = 0
    for (const frame of this.frames) {
      const audioSize = JSON.stringify(frame.audioData).length
      const paramsSize = JSON.stringify(frame.params).length
      const modeStateSize = frame.modeState
        ? JSON.stringify(frame.modeState).length
        : 0
      total += audioSize + paramsSize + modeStateSize
    }
    return total
  }

  clear() {
    this.frames = []
    this.frameIndex = 0
  }

  exportAsJSON() {
    return JSON.stringify(this.frames, null, 2)
  }

  importFromJSON(json) {
    try {
      this.frames = JSON.parse(json)
      this.frameIndex = this.frames.length
      this.startTime = this.frames.length > 0
        ? performance.now() - this.frames[0].timestamp
        : performance.now()
      return true
    } catch (e) {
      console.error('Failed to import frames:', e)
      return false
    }
  }
}

export const frameRecorder = new FrameRecorder()
