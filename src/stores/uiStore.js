import { create } from 'zustand'

export const useUIStore = create((set, get) => ({
  // Toggle states
  fxEnabled: true,
  godMode: false,
  debugEnabled: false,

  // Toggles
  toggleFX: () => set(s => ({ fxEnabled: !s.fxEnabled })),
  toggleGodMode: () => set(s => ({ godMode: !s.godMode })),
  toggleDebug: () => set(s => ({ debugEnabled: !s.debugEnabled })),

  // Camera reset callback (set by SceneManager)
  resetCameraFn: null,
  setResetCameraFn: (fn) => set({ resetCameraFn: fn }),
  resetCamera: () => {
    const { resetCameraFn } = get()
    if (resetCameraFn) resetCameraFn()
  }
}))
