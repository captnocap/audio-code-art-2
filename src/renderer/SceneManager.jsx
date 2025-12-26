import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useAudioStore } from '../stores/audioStore'
import { useModeStore } from '../stores/modeStore'
import { useFXStore } from '../stores/fxStore'
import { useModMatrixStore } from '../stores/modMatrixStore'
import { useUIStore } from '../stores/uiStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { expressionEngine } from '../core/ExpressionEngine'
import { frameRecorder } from '../core/FrameRecorder'
import SceneDebugMap from '../components/debug/SceneDebugMap'
import PostFXStack from '../effects/PostFXStack'

// Only JSX mode components
import NeuralDreamsMode from '../modes/NeuralDreams'
import WormholeNativeMode from '../modes/WormholeNative'
import WormholeMode from '../modes/Wormhole'
import PsychedelicMode from '../modes/Psychedelic'
import SpirographMode from '../modes/Spirograph'
import RingsMode from '../modes/Rings'
import BeachMode from '../modes/Beach'
import MandalaMode from '../modes/Mandala'
import FlowParticlesMode from '../modes/FlowParticles'
import AudiosurfMode from '../modes/Audiosurf'
import MirrorMode from '../modes/Mirror'
import CymaticsMode from '../modes/Cymatics'
import VoronoiMode from '../modes/Voronoi'
import PixelSortMode from '../modes/PixelSort'
import BSPGalleryMode from '../modes/BSPGallery'

const MODES = {
  neuralDreams: NeuralDreamsMode,
  wormholeNative: WormholeNativeMode,
  wormhole: WormholeMode,
  psychedelic: PsychedelicMode,
  spirograph: SpirographMode,
  rings: RingsMode,
  beach: BeachMode,
  mandala: MandalaMode,
  flowParticles: FlowParticlesMode,
  audiosurf: AudiosurfMode,
  mirror: MirrorMode,
  cymatics: CymaticsMode,
  voronoi: VoronoiMode,
  pixelSort: PixelSortMode,
  bspGallery: BSPGalleryMode
}

export default function SceneManager() {
  const { gl, camera, scene } = useThree()
  const currentMode = useModeStore(s => s.currentMode)
  const getCurrentMode = useModeStore(s => s.getCurrentMode)
  const getCurrentParams = useModeStore(s => s.getCurrentParams)
  const getAudioData = useAudioStore(s => s.getAudioData)

  const fxEnabled = useUIStore(s => s.fxEnabled)
  const godMode = useUIStore(s => s.godMode)
  const debugEnabled = useUIStore(s => s.debugEnabled)
  const toggleFX = useUIStore(s => s.toggleFX)
  const toggleGodMode = useUIStore(s => s.toggleGodMode)
  const toggleDebug = useUIStore(s => s.toggleDebug)
  const setResetCameraFn = useUIStore(s => s.setResetCameraFn)
  const resetCamera = useUIStore(s => s.resetCamera)

  const {
    isRecording,
    isPlaying,
    isPaused,
    playbackMode,
    advanceFrame,
    startRecording,
    stopRecording
  } = usePlaybackStore()

  const orbitRef = useRef()

  const modeConfig = getCurrentMode()
  const modeWantsOrbit = modeConfig?.orbitControls ?? false
  const orbitEnabled = godMode || modeWantsOrbit

  useEffect(() => {
    setResetCameraFn(() => {
      camera.position.set(0, 0, 5)
      camera.lookAt(0, 0, 0)
      if (orbitRef.current) {
        orbitRef.current.reset()
      }
    })
  }, [camera, setResetCameraFn])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'd' || e.key === 'D') toggleDebug()
      if (e.key === 'g' || e.key === 'G') toggleGodMode()
      if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey) {
          usePlaybackStore.getState().clearRecording()
        } else {
          const { isRecording } = usePlaybackStore.getState()
          if (isRecording) {
            stopRecording()
          } else {
            startRecording()
          }
        }
      }
      if (e.key === 'f' || e.key === 'F') toggleFX()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleDebug, toggleGodMode, toggleFX, startRecording, stopRecording])

  useEffect(() => {
    scene.background = null
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, -50)
  }, [scene, camera])

  const modMatrixRoutes = useModMatrixStore(s => s.routes)
  const applyModulation = useModMatrixStore(s => s.applyModulation)

  const audioContextRef = useRef({
    bass: 0, mid: 0, high: 0, amplitude: 0,
    beat: 0, beatPulse: 0, lfo1: 0, lfo2: 0,
    envelope: 0, time: 0
  })

  const evaluatedParamsRef = useRef({})

  const visualTimeRef = useRef(0)

  const modeStateRef = useRef(null)

  useFrame((state) => {
    const playback = usePlaybackStore.getState()
    let audioContext = {}

    if (playbackMode === 'playback' && !isPaused) {
      const frameData = playback.getCurrentFrame()
      if (frameData) {
        audioContext = {
          ...frameData.audioData,
          time: frameData.timestamp / 1000
        }
        visualTimeRef.current = frameData.timestamp / 1000
      }
    } else {
      const data = getAudioData()
      audioContext = {
        bass: data.bass,
        mid: data.mid,
        high: data.high,
        amplitude: data.amplitude,
        beat: data.beat,
        beatPulse: data.beatPulse,
        lfo1: data.lfo1,
        lfo2: data.lfo2,
        envelope: data.envelope,
        time: performance.now() / 1000
      }
      audioContextRef.current = audioContext

      if (playbackMode === 'live') {
        visualTimeRef.current = state.clock.elapsedTime

        if (isRecording) {
          const params = getCurrentParams()
          frameRecorder.captureFrame(gl, audioContext, currentMode, params, modeStateRef.current)
        }
      }

      if (playbackMode === 'playback' && isPlaying && !isPaused) {
        advanceFrame()
      }
    }

    audioContextRef.current = audioContext

    const rawParams = getCurrentParams()
    const evaluated = {}
    for (const [name, paramDef] of Object.entries(rawParams)) {
      let value
      if (paramDef.type === 'expression') {
        value = expressionEngine.evaluate(paramDef.value, audioContext)
      } else {
        value = paramDef.value
      }
      value = applyModulation(name, value, audioContext)
      evaluated[name] = value
    }
    evaluatedParamsRef.current = evaluated
  })

  const params = getCurrentParams()
  const ModeComponent = MODES[currentMode]

  if (!ModeComponent) {
    return null
  }

  return (
    <>
      {orbitEnabled && (
        <OrbitControls
          ref={orbitRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          panSpeed={1}
          zoomSpeed={1}
          rotateSpeed={0.5}
          minDistance={1}
          maxDistance={500}
        />
      )}

      {fxEnabled ? (
        <PostFXStack
          audioContext={audioContextRef.current}
          visualTime={visualTimeRef.current}
        >
          <ModeComponent
            audioContext={audioContextRef.current}
            params={evaluatedParamsRef}
            orbitEnabled={orbitEnabled}
            visualTime={visualTimeRef.current}
            modeStateRef={modeStateRef}
            isPlaying={isPlaying && !isPaused}
            isRecording={isRecording}
          />
        </PostFXStack>
      ) : (
        <ModeComponent
          audioContext={audioContextRef.current}
          params={evaluatedParamsRef}
          orbitEnabled={orbitEnabled}
          visualTime={visualTimeRef.current}
          modeStateRef={modeStateRef}
          isPlaying={isPlaying && !isPaused}
          isRecording={isRecording}
        />
      )}

      <SceneDebugMap enabled={debugEnabled} />
    </>
  )
}

export { MODES }
