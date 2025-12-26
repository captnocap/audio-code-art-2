import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree, createPortal } from '@react-three/fiber'
import * as THREE from 'three'
import { useFXStore } from '../stores/fxStore'
import { expressionEngine } from '../core/ExpressionEngine'

const copyShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
    }
  `
}

const feedbackShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tCurrent;
    uniform sampler2D tPrevious;
    uniform float amount;
    uniform float decay;
    uniform float zoom;
    uniform float rotation;

    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      vec2 uv = vUv;

      vec2 prevUv = uv - center;
      prevUv /= zoom;
      float s = sin(rotation);
      float c = cos(rotation);
      prevUv = vec2(prevUv.x * c - prevUv.y * s, prevUv.x * s + prevUv.y * c);
      prevUv += center;

      vec4 current = texture2D(tCurrent, uv);
      vec4 previous = vec4(0.0);

      if (prevUv.x >= 0.0 && prevUv.x <= 1.0 && prevUv.y >= 0.0 && prevUv.y <= 1.0) {
        previous = texture2D(tPrevious, prevUv) * decay;
      }

      gl_FragColor = clamp(current + previous * amount, 0.0, 1.0);
    }
  `
}

const bloomShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float threshold;
    uniform float intensity;
    uniform float radius;
    uniform vec2 resolution;

    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 bloom = vec3(0.0);

      if (brightness > threshold) {
        vec2 texel = radius / resolution;
        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texel;
            vec4 texColor = texture2D(tDiffuse, vUv + offset);
            float b = dot(texColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (b > threshold) {
              bloom += texColor.rgb * (1.0 - length(offset) / (texel.x * 3.0));
            }
          }
        }
        bloom /= 25.0;
      }

      gl_FragColor = vec4(color.rgb + bloom * intensity, color.a);
    }
  `
}

const rgbSplitShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float angle;

    varying vec2 vUv;

    void main() {
      vec2 dir = vec2(cos(angle), sin(angle)) * amount;

      float r = texture2D(tDiffuse, vUv + dir).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
}

const pixelMeltShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float blockSize;
    uniform float noiseScale;
    uniform float time;
    uniform vec2 resolution;

    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 blockUv = floor(vUv * resolution / blockSize) * blockSize / resolution;
      float noise = hash(blockUv + floor(time * 2.0));

      vec2 offset = vec2(
        (noise - 0.5) * 2.0 * intensity,
        (hash(blockUv + 1.0) - 0.5) * 2.0 * intensity * 0.5
      );

      if (noise > 0.7) {
        vec2 displaced = vUv + offset;
        gl_FragColor = texture2D(tDiffuse, displaced);
      } else {
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    }
  `
}

function FXRenderer({ children, audioContext, visualTime }) {
  const { gl, size, camera } = useThree()
  const getEnabledEffects = useFXStore(s => s.getEnabledEffects)

  const [portalScene] = useState(() => new THREE.Scene())
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const [fxScene] = useState(() => new THREE.Scene())

  const targets = useMemo(() => {
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
      depthBuffer: true
    }
    return {
      scene: new THREE.WebGLRenderTarget(size.width, size.height, opts),
      feedbackA: new THREE.WebGLRenderTarget(size.width, size.height, opts),
      feedbackB: new THREE.WebGLRenderTarget(size.width, size.height, opts),
      tempA: new THREE.WebGLRenderTarget(size.width, size.height, opts),
      tempB: new THREE.WebGLRenderTarget(size.width, size.height, opts)
    }
  }, [])

  const tempIndex = useRef(0)
  const feedbackIndex = useRef(0)

  const copyMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: copyShader.vertexShader,
    fragmentShader: copyShader.fragmentShader,
    uniforms: { tDiffuse: { value: null } },
    depthTest: false,
    depthWrite: false
  }), [])

  const feedbackMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: feedbackShader.vertexShader,
    fragmentShader: feedbackShader.fragmentShader,
    uniforms: {
      tCurrent: { value: null },
      tPrevious: { value: null },
      amount: { value: 0.5 },
      decay: { value: 0.95 },
      zoom: { value: 1.0 },
      rotation: { value: 0.0 }
    },
    depthTest: false,
    depthWrite: false
  }), [])

  const bloomMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: bloomShader.vertexShader,
    fragmentShader: bloomShader.fragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      threshold: { value: 0.5 },
      intensity: { value: 1.0 },
      radius: { value: 0.5 },
      resolution: { value: new THREE.Vector2(size.width, size.height) }
    },
    depthTest: false,
    depthWrite: false
  }), [])

  const rgbSplitMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: rgbSplitShader.vertexShader,
    fragmentShader: rgbSplitShader.fragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: 0.005 },
      angle: { value: 0.0 }
    },
    depthTest: false,
    depthWrite: false
  }), [])

  const pixelMeltMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: pixelMeltShader.vertexShader,
    fragmentShader: pixelMeltShader.fragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      intensity: { value: 0.1 },
      blockSize: { value: 8.0 },
      noiseScale: { value: 2.0 },
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector2(size.width, size.height) }
    },
    depthTest: false,
    depthWrite: false
  }), [])

  const quadGeom = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const quadMesh = useMemo(() => {
    const mesh = new THREE.Mesh(quadGeom, copyMaterial)
    mesh.frustumCulled = false
    return mesh
  }, [quadGeom, copyMaterial])

  useEffect(() => {
    fxScene.add(quadMesh)
    return () => fxScene.remove(quadMesh)
  }, [fxScene, quadMesh])

  useEffect(() => {
    Object.values(targets).forEach(t => t.setSize(size.width, size.height))
  }, [size, targets])

  useEffect(() => {
    return () => {
      Object.values(targets).forEach(t => t.dispose())
      copyMaterial.dispose()
      feedbackMaterial.dispose()
      bloomMaterial.dispose()
      rgbSplitMaterial.dispose()
      pixelMeltMaterial.dispose()
      quadGeom.dispose()
    }
  }, [targets, copyMaterial, feedbackMaterial, bloomMaterial, rgbSplitMaterial, pixelMeltMaterial, quadGeom])

  useFrame(() => {
    const effects = getEnabledEffects()

    const originalBackground = portalScene.background

    portalScene.background = null
    gl.setRenderTarget(targets.scene)
    gl.clear()
    gl.render(portalScene, camera)

    let currentTexture = targets.scene.texture

    const ctx = audioContext || {
      bass: 0, mid: 0, high: 0, beat: 0, amplitude: 0,
      lfo1: 0, lfo2: 0, envelope: 0,
      time: performance.now() / 1000
    }

    const evalUniform = (uniform, defaultVal) => {
      if (!uniform) return defaultVal
      if (uniform.type === 'expression') {
        return expressionEngine.evaluate(uniform.value, ctx)
      }
      return uniform.value ?? defaultVal
    }

    for (const effect of effects) {
      if (effect.id === 'feedback') {
        const readTarget = feedbackIndex.current === 0 ? targets.feedbackB : targets.feedbackA
        const writeTarget = feedbackIndex.current === 0 ? targets.feedbackA : targets.feedbackB

        feedbackMaterial.uniforms.amount.value = Math.max(0, Math.min(1, evalUniform(effect.uniforms.amount, 0.5)))
        feedbackMaterial.uniforms.decay.value = Math.max(0.8, Math.min(0.999, evalUniform(effect.uniforms.decay, 0.95)))
        feedbackMaterial.uniforms.zoom.value = Math.max(0.95, Math.min(1.05, evalUniform(effect.uniforms.zoom, 1.0)))
        feedbackMaterial.uniforms.rotation.value = evalUniform(effect.uniforms.rotation, 0.0)

        feedbackMaterial.uniforms.tCurrent.value = currentTexture
        feedbackMaterial.uniforms.tPrevious.value = readTarget.texture

        quadMesh.material = feedbackMaterial
        gl.setRenderTarget(writeTarget)
        gl.render(fxScene, orthoCamera)

        feedbackIndex.current = 1 - feedbackIndex.current
        currentTexture = writeTarget.texture
      }

      if (effect.id === 'bloom') {
        const writeTarget = tempIndex.current === 0 ? targets.tempA : targets.tempB

        bloomMaterial.uniforms.tDiffuse.value = currentTexture
        bloomMaterial.uniforms.threshold.value = evalUniform(effect.uniforms.threshold, 0.5)
        bloomMaterial.uniforms.intensity.value = evalUniform(effect.uniforms.intensity, 1.0)
        bloomMaterial.uniforms.radius.value = evalUniform(effect.uniforms.radius, 0.5)
        bloomMaterial.uniforms.resolution.value.set(size.width, size.height)

        quadMesh.material = bloomMaterial
        gl.setRenderTarget(writeTarget)
        gl.render(fxScene, orthoCamera)

        tempIndex.current = 1 - tempIndex.current
        currentTexture = writeTarget.texture
      }

      if (effect.id === 'rgbSplit') {
        const writeTarget = tempIndex.current === 0 ? targets.tempA : targets.tempB

        rgbSplitMaterial.uniforms.tDiffuse.value = currentTexture
        rgbSplitMaterial.uniforms.amount.value = evalUniform(effect.uniforms.amount, 0.005)
        rgbSplitMaterial.uniforms.angle.value = evalUniform(effect.uniforms.angle, 0)

        quadMesh.material = rgbSplitMaterial
        gl.setRenderTarget(writeTarget)
        gl.render(fxScene, orthoCamera)

        tempIndex.current = 1 - tempIndex.current
        currentTexture = writeTarget.texture
      }

      if (effect.id === 'pixelMelt') {
        const writeTarget = tempIndex.current === 0 ? targets.tempA : targets.tempB

        pixelMeltMaterial.uniforms.tDiffuse.value = currentTexture
        pixelMeltMaterial.uniforms.intensity.value = evalUniform(effect.uniforms.intensity, 0.1)
        pixelMeltMaterial.uniforms.blockSize.value = evalUniform(effect.uniforms.blockSize, 8)
        pixelMeltMaterial.uniforms.noiseScale.value = evalUniform(effect.uniforms.noiseScale, 2.0)
        pixelMeltMaterial.uniforms.time.value = visualTime ?? 0
        pixelMeltMaterial.uniforms.resolution.value.set(size.width, size.height)

        quadMesh.material = pixelMeltMaterial
        gl.setRenderTarget(writeTarget)
        gl.render(fxScene, orthoCamera)

        tempIndex.current = 1 - tempIndex.current
        currentTexture = writeTarget.texture
      }
    }

    quadMesh.material = copyMaterial
    copyMaterial.uniforms.tDiffuse.value = currentTexture
    gl.setRenderTarget(null)
    gl.render(fxScene, orthoCamera)

    portalScene.background = originalBackground
  }, 1)

  return createPortal(children, portalScene)
}

export default function PostFXStack({ audioContext, visualTime, children }) {
  // Always render FXRenderer to preserve feedback buffers across effect toggles
  return <FXRenderer audioContext={audioContext} visualTime={visualTime}>{children}</FXRenderer>
}
