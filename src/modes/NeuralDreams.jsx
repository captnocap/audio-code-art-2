import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const ncaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ncaFragmentShader = `
  precision highp float;
  uniform sampler2D uState;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uDelta;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uAmplitude;
  uniform float uChaos;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 state = texture2D(uState, vUv);

    vec4 lap = vec4(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec4 s = texture2D(uState, vUv + vec2(float(x), float(y)) * texel);
        float weight = (x == 0 && y == 0) ? -1.0 : (x == 0 || y == 0) ? 0.2 : 0.05;
        lap += s * weight;
      }
    }

    float A = state.r;
    float B = state.g;
    float feed = 0.037 + uBass * 0.02;
    float kill = 0.06 + uHigh * 0.01;

    float reaction = A * B * B;
    float newA = A + (1.0 * lap.r - reaction + feed * (1.0 - A)) * uDelta * 2.0;
    float newB = B + (0.5 * lap.g + reaction - (kill + feed) * B) * uDelta * 2.0;

    float wave1 = sin(vUv.x * 20.0 + vUv.y * 10.0 + uTime * 3.0) * 0.5 + 0.5;
    float wave2 = sin(length(vUv - 0.5) * 30.0 - uTime * 4.0) * 0.5 + 0.5;

    float stim = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 stimPoint = vec2(0.5) + vec2(sin(uTime + fi), cos(uTime * 0.7 + fi)) * 0.3;
      stim += exp(-distance(vUv, stimPoint) * 8.0) * uAmplitude;
    }

    vec4 newState = state;
    newState.r = mix(newA, wave1, 0.2) + stim * 0.3;
    newState.g = mix(newB, wave2, 0.15);
    newState.b = mix(state.b, wave1 * stim * 2.0, 0.3) * 0.95;
    newState.a = mix(state.a, (newState.r + newState.g) * 0.5, 0.1) * 0.995;

    if (uChaos > 0.3 && hash(vUv + uTime) < uChaos * 0.1) {
      newState = vec4(hash(vUv), hash(vUv * 2.0), hash(vUv * 3.0), 1.0);
    }

    gl_FragColor = clamp(newState, 0.0, 1.0);
  }
`

const tunnelVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform sampler2D uNCA;
  uniform float uScrollOffset;
  uniform float uDreamIntensity;
  uniform float uTime;

  void main() {
    vUv = uv;
    vNormal = normal;

    vec2 ncaUV = vec2(uv.x, fract(uv.y + uScrollOffset));
    vec4 nca = texture2D(uNCA, ncaUV);

    float displacement = (nca.r * 2.0 + nca.a) * uDreamIntensity * 3.0;
    displacement += sin(uTime * 3.0 + uv.x * 20.0) * nca.g * 0.5;

    vec3 pos = position;
    vec3 dir = normalize(vec3(position.x, position.y, 0.0));
    pos -= dir * displacement;

    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const tunnelFragmentShader = `
  uniform sampler2D uNCA;
  uniform float uTime;
  uniform float uScrollOffset;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uAmplitude;
  uniform float uBeat;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float depthRatio = clamp(-vPosition.z / 150.0, 0.0, 1.0);
    float closeness = 1.0 - depthRatio;

    vec2 ncaUV = vec2(fract(vUv.x + uTime * 0.1), fract(vUv.y + uScrollOffset));
    vec4 nca = texture2D(uNCA, ncaUV);

    vec3 col = vec3(0.01, 0.0, 0.03);

    float warpIntensity = 0.0;
    float warpHue = 0.0;

    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float angleOffset = fi * 0.5;
      float speed = 8.0 + fi * 2.0 + uBass * 10.0;
      float streakAngle = vUv.x * 6.28318 + angleOffset;
      float streak = sin(streakAngle * (8.0 + fi * 2.0));
      float flow = vUv.y * 100.0 - uTime * speed;
      float flowPattern = sin(flow + streak * 3.0);
      float streakLine = smoothstep(0.7, 0.95, flowPattern);
      float layerIntensity = streakLine * (0.3 + closeness * 0.7);

      if (i < 3) layerIntensity *= (0.5 + uBass);
      else if (i < 6) layerIntensity *= (0.5 + uMid);
      else layerIntensity *= (0.5 + uHigh);

      warpIntensity += layerIntensity;
      warpHue += (fi / 8.0 + uTime * 0.1) * layerIntensity;
    }

    if (warpIntensity > 0.0) warpHue = warpHue / warpIntensity;
    col += hsv2rgb(vec3(fract(warpHue), 1.0, 1.0)) * warpIntensity * 1.5;

    col += vec3(0.9, 0.1, 0.4) * nca.r * 0.4 * closeness;
    col += vec3(0.0, 0.6, 0.9) * nca.g * 0.5 * closeness;
    col += vec3(1.0, 0.8, 0.3) * nca.b * 0.6 * closeness;

    float edge = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
    col += hsv2rgb(vec3(fract(vUv.x + uTime * 0.2), 1.0, 1.0)) * pow(edge, 2.0) * 0.6;

    col *= 1.0 + uBeat * 3.0;

    float sparkle = step(0.96, hash(vUv * 150.0 + floor(uTime * 30.0)));
    col += hsv2rgb(vec3(hash(vUv * 50.0), 1.0, 1.0)) * sparkle * closeness;

    col = mix(col, vec3(0.05, 0.0, 0.1), depthRatio * depthRatio * 0.4);

    col = clamp(col, 0.0, 8.0);
    col = col / (1.0 + col * 0.25);

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function NeuralDreamsMode({ audioContext, params, visualTime, modeStateRef, isPlaying, isRecording }) {
  const { gl } = useThree()
  const ncaSize = 256

  const tunnelRef = useRef()
  const ncaTargetA = useRef()
  const ncaTargetB = useRef()
  const ncaMaterial = useRef()
  const tunnelMaterial = useRef()
  const currentTarget = useRef('A')
  const scrollOffset = useRef(0)
  const smoothedAudio = useRef({ bass: 0, mid: 0, high: 0, amplitude: 0 })
  const chaosLevel = useRef(0)
  const beatPulse = useRef(0)
  const tunnelRotation = useRef(0)

  useEffect(() => {
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    }

    ncaTargetA.current = new THREE.WebGLRenderTarget(ncaSize, ncaSize, options)
    ncaTargetB.current = new THREE.WebGLRenderTarget(ncaSize, ncaSize, options)

    seedNCA(gl, ncaTargetA.current, ncaTargetB.current, ncaSize)

    if (modeStateRef) {
      modeStateRef.current = {
        ncaTargetA,
        ncaTargetB,
        currentTarget,
        scrollOffset,
        chaosLevel,
        beatPulse,
        tunnelRotation
      }
    }

    return () => {
      ncaTargetA.current?.dispose()
      ncaTargetB.current?.dispose()
    }
  }, [gl])

  const ncaShaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uResolution: { value: new THREE.Vector2(ncaSize, ncaSize) },
        uTime: { value: 0 },
        uDelta: { value: 0.016 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uAmplitude: { value: 0 },
        uChaos: { value: 0 }
      },
      vertexShader: ncaVertexShader,
      fragmentShader: ncaFragmentShader
    })
  }, [])

  const tunnelShaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uNCA: { value: null },
        uTime: { value: 0 },
        uScrollOffset: { value: 0 },
        uDreamIntensity: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uAmplitude: { value: 0 },
        uBeat: { value: 0 }
      },
      vertexShader: tunnelVertexShader,
      fragmentShader: tunnelFragmentShader,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  ncaMaterial.current = ncaShaderMaterial
  tunnelMaterial.current = tunnelShaderMaterial

  useFrame((state, delta) => {
    if (!ncaTargetA.current || !ncaTargetB.current) return

    const timeToUse = visualTime !== undefined ? visualTime : state.clock.elapsedTime
    const deltaToUse = isRecording ? Math.min(delta, 0.05) : delta

    const { bass = 0, mid = 0, high = 0, amplitude = 0, beat = 0, beatPulse: bp = 0 } = audioContext || {}

    smoothedAudio.current.bass = bass
    smoothedAudio.current.mid = mid
    smoothedAudio.current.high = high
    smoothedAudio.current.amplitude = amplitude

    if (beat > 0.8) chaosLevel.current = beat
    chaosLevel.current *= 0.95
    beatPulse.current = Math.max(beatPulse.current * 0.85, bp)

    const readTarget = currentTarget.current === 'A' ? ncaTargetA.current : ncaTargetB.current
    const writeTarget = currentTarget.current === 'A' ? ncaTargetB.current : ncaTargetA.current

    ncaShaderMaterial.uniforms.uState.value = readTarget.texture
    ncaShaderMaterial.uniforms.uTime.value = timeToUse
    ncaShaderMaterial.uniforms.uDelta.value = deltaToUse
    ncaShaderMaterial.uniforms.uBass.value = smoothedAudio.current.bass
    ncaShaderMaterial.uniforms.uMid.value = smoothedAudio.current.mid
    ncaShaderMaterial.uniforms.uHigh.value = smoothedAudio.current.high
    ncaShaderMaterial.uniforms.uAmplitude.value = smoothedAudio.current.amplitude
    ncaShaderMaterial.uniforms.uChaos.value = chaosLevel.current

    const ncaScene = new THREE.Scene()
    const ncaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const ncaQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ncaShaderMaterial)
    ncaScene.add(ncaQuad)

    gl.setRenderTarget(writeTarget)
    gl.render(ncaScene, ncaCamera)
    gl.setRenderTarget(null)

    currentTarget.current = currentTarget.current === 'A' ? 'B' : 'A'

    scrollOffset.current += (0.02 + smoothedAudio.current.amplitude * 0.05) * deltaToUse

    tunnelShaderMaterial.uniforms.uNCA.value = writeTarget.texture
    tunnelShaderMaterial.uniforms.uTime.value = timeToUse
    tunnelShaderMaterial.uniforms.uScrollOffset.value = scrollOffset.current

    tunnelShaderMaterial.uniforms.uDreamIntensity.value = smoothedAudio.current.amplitude
    tunnelShaderMaterial.uniforms.uBass.value = smoothedAudio.current.bass
    tunnelShaderMaterial.uniforms.uMid.value = smoothedAudio.current.mid
    tunnelShaderMaterial.uniforms.uHigh.value = smoothedAudio.current.high
    tunnelShaderMaterial.uniforms.uAmplitude.value = smoothedAudio.current.amplitude
    tunnelShaderMaterial.uniforms.uBeat.value = beatPulse.current

    tunnelRotation.current += deltaToUse * 0.05
    if (tunnelRef.current) {
      tunnelRef.current.rotation.z = tunnelRotation.current
      tunnelRef.current.rotation.x = Math.sin(timeToUse * 0.05) * 0.03
      tunnelRef.current.rotation.y = Math.cos(timeToUse * 0.04) * 0.03
    }

    state.camera.position.set(0, 0, 5)
    state.camera.lookAt(0, 0, -30)
  })

  const tunnelGeometry = useMemo(() => {
    const segments = 48
    const rings = 100
    const radius = 12
    const length = 150

    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, rings, true)
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, 0, -length / 2)

    return geometry
  }, [])

  return (
    <group>
      <mesh ref={tunnelRef} geometry={tunnelGeometry} material={tunnelShaderMaterial} />

      <pointLight
        color="#ff00ff"
        intensity={2 + (smoothedAudio.current?.bass || 0) * 4}
        distance={100}
        position={[0, 0, 10]}
      />
      <pointLight
        color="#00ffff"
        intensity={1 + (smoothedAudio.current?.high || 0) * 2}
        distance={50}
        position={[10, 0, -20]}
      />
      <pointLight
        color="#ff0066"
        intensity={1 + (smoothedAudio.current?.mid || 0) * 2}
        distance={50}
        position={[-10, 0, -40]}
      />
    </group>
  )
}

function seedNCA(gl, targetA, targetB, size) {
  const data = new Float32Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const u = x / size
      const v = y / size

      let seed = 0
      for (let b = 0; b < 20; b++) {
        const bx = Math.sin(b * 7.3) * 0.4 + 0.5
        const by = Math.cos(b * 11.7) * 0.4 + 0.5
        const dist = Math.sqrt((u - bx) ** 2 + (v - by) ** 2)
        seed += Math.exp(-dist * 20) * 0.5
      }

      const wave = Math.sin(u * 15 + v * 10) * 0.3
      const noise = Math.sin(u * 50) * Math.sin(v * 50) * 0.2

      data[i + 0] = Math.min(1, 0.8 + noise + wave)
      data[i + 1] = Math.min(1, seed * 0.8 + noise * 0.3)
      data[i + 2] = Math.random() * 0.3
      data[i + 3] = 0.5 + wave + noise
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType)
  texture.needsUpdate = true

  const copyMaterial = new THREE.MeshBasicMaterial({ map: texture })
  const copyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial)
  const copyScene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  copyScene.add(copyQuad)

  gl.setRenderTarget(targetA)
  gl.render(copyScene, camera)
  gl.setRenderTarget(targetB)
  gl.render(copyScene, camera)
  gl.setRenderTarget(null)

  copyMaterial.dispose()
  copyQuad.geometry.dispose()
  texture.dispose()
}
