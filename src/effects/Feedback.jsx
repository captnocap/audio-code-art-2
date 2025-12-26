import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree, createPortal } from '@react-three/fiber'
import * as THREE from 'three'
import { expressionEngine } from '../core/ExpressionEngine'

// Feedback shader - blends current frame with previous frame
const feedbackShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tCurrent;
    uniform sampler2D tPrevious;
    uniform float amount;
    uniform float decay;
    uniform float zoom;
    uniform float rotation;
    uniform vec2 resolution;

    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      vec2 uv = vUv;

      // Apply zoom and rotation to previous frame UV
      vec2 prevUv = uv - center;

      // Zoom
      prevUv /= zoom;

      // Rotation
      float s = sin(rotation);
      float c = cos(rotation);
      prevUv = vec2(
        prevUv.x * c - prevUv.y * s,
        prevUv.x * s + prevUv.y * c
      );

      prevUv += center;

      // Sample textures
      vec4 current = texture2D(tCurrent, uv);

      // Only sample previous if within bounds
      vec4 previous = vec4(0.0);
      if (prevUv.x >= 0.0 && prevUv.x <= 1.0 && prevUv.y >= 0.0 && prevUv.y <= 1.0) {
        previous = texture2D(tPrevious, prevUv) * decay;
      }

      // Blend: current + previous * amount
      vec4 result = current + previous * amount;

      // Prevent accumulation overflow
      result = clamp(result, 0.0, 1.0);

      gl_FragColor = result;
    }
  `
}

export default function FeedbackEffect({
  enabled = true,
  uniforms = {},
  audioContext,
  inputTexture,
  onRender
}) {
  const { gl, size } = useThree()
  const meshRef = useRef()

  // Create ping-pong render targets
  const targets = useMemo(() => {
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    }
    return [
      new THREE.WebGLRenderTarget(size.width, size.height, opts),
      new THREE.WebGLRenderTarget(size.width, size.height, opts)
    ]
  }, [])

  // Track which target to write to
  const writeIndex = useRef(0)

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: feedbackShader.vertexShader,
      fragmentShader: feedbackShader.fragmentShader,
      uniforms: {
        tCurrent: { value: null },
        tPrevious: { value: null },
        amount: { value: 0.92 },
        decay: { value: 0.98 },
        zoom: { value: 1.0 },
        rotation: { value: 0.0 },
        resolution: { value: new THREE.Vector2(size.width, size.height) }
      }
    })
  }, [])

  // Resize targets when size changes
  useEffect(() => {
    targets[0].setSize(size.width, size.height)
    targets[1].setSize(size.width, size.height)
    material.uniforms.resolution.value.set(size.width, size.height)
  }, [size, targets, material])

  // Cleanup
  useEffect(() => {
    return () => {
      targets[0].dispose()
      targets[1].dispose()
      material.dispose()
    }
  }, [targets, material])

  // Update uniforms from expressions each frame
  useFrame(() => {
    if (!enabled || !inputTexture) return

    // Evaluate expression uniforms
    const context = audioContext || { bass: 0, mid: 0, high: 0, beat: 0, time: performance.now() / 1000 }

    // Amount
    if (uniforms.amount?.type === 'expression') {
      const val = expressionEngine.evaluate(uniforms.amount.value, context)
      material.uniforms.amount.value = Math.max(0, Math.min(1, val))
    } else if (uniforms.amount?.value !== undefined) {
      material.uniforms.amount.value = uniforms.amount.value
    }

    // Decay
    if (uniforms.decay?.type === 'expression') {
      const val = expressionEngine.evaluate(uniforms.decay.value, context)
      material.uniforms.decay.value = Math.max(0, Math.min(1, val))
    } else if (uniforms.decay?.value !== undefined) {
      material.uniforms.decay.value = uniforms.decay.value
    }

    // Zoom
    if (uniforms.zoom?.type === 'expression') {
      const val = expressionEngine.evaluate(uniforms.zoom.value, context)
      material.uniforms.zoom.value = Math.max(0.5, Math.min(2, val))
    } else if (uniforms.zoom?.value !== undefined) {
      material.uniforms.zoom.value = uniforms.zoom.value
    }

    // Rotation
    if (uniforms.rotation?.type === 'expression') {
      const val = expressionEngine.evaluate(uniforms.rotation.value, context)
      material.uniforms.rotation.value = val
    } else if (uniforms.rotation?.value !== undefined) {
      material.uniforms.rotation.value = uniforms.rotation.value
    }

    // Get read/write targets
    const readTarget = targets[1 - writeIndex.current]
    const writeTarget = targets[writeIndex.current]

    // Set textures
    material.uniforms.tCurrent.value = inputTexture
    material.uniforms.tPrevious.value = readTarget.texture

    // Render to write target
    const mesh = meshRef.current
    if (mesh) {
      const originalTarget = gl.getRenderTarget()
      gl.setRenderTarget(writeTarget)
      gl.render(mesh.parent, mesh.parent.userData.orthoCamera)
      gl.setRenderTarget(originalTarget)
    }

    // Swap targets
    writeIndex.current = 1 - writeIndex.current

    // Notify parent of output texture
    if (onRender) {
      onRender(writeTarget.texture)
    }
  })

  if (!enabled) return null

  return (
    <mesh ref={meshRef} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
