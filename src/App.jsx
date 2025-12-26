import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { useAudioStore } from './stores/audioStore'
import SceneManager from './renderer/SceneManager'
import AudioInitPrompt from './ui/AudioInitPrompt'
import ImmersiveShell from './components/ui/ImmersiveShell'

import * as THREE from 'three'

export default function App() {
  const { isInitialized, initialize, resumeIfNeeded } = useAudioStore()

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumeIfNeeded()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [resumeIfNeeded])

  return (
    <ImmersiveShell>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          alpha: false,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping
        }}
        className="block w-full h-full"
      >
        <Suspense fallback={null}>
          <SceneManager />
        </Suspense>
      </Canvas>

      {!isInitialized && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <AudioInitPrompt onInit={initialize} />
        </div>
      )}
    </ImmersiveShell>
  )
}
