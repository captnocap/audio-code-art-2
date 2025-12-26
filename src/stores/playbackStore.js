import { create } from 'zustand'

const MAX_MEMORY_MB = 2048
const SAFETY_BUFFER_MB = 256

const getAvailableMemory = () => {
  if (typeof performance !== 'undefined' && performance.memory) {
    const used = performance.memory.usedJSHeapSize
    const total = performance.memory.totalJSHeapSize
    const available = total - used
    return Math.min(available, (MAX_MEMORY_MB - SAFETY_BUFFER_MB) * 1024 * 1024)
  }
  return (MAX_MEMORY_MB - SAFETY_BUFFER_MB) * 1024 * 1024
}

const estimateFrameSize = (mode, hasTextureState) => {
  const baseSize = 1024
  const audioDataSize = 512
  const modeStateSize = hasTextureState ? 262144 : 256
  return baseSize + audioDataSize + modeStateSize
}

const calculateMaxFrames = (availableBytes, mode, hasTextureState) => {
  const frameBytes = estimateFrameSize(mode, hasTextureState)
  return Math.floor(availableBytes / frameBytes)
}

export const usePlaybackStore = create((set, get) => ({
  isRecording: false,
  isPlaying: false,
  isPaused: false,
  currentFrame: 0,
  totalFrames: 0,
  recordedFrames: [],
  markedStart: null,
  markedEnd: null,
  maxFramesEstimate: 0,

  playbackMode: 'live',

  setPlaybackMode: (mode) => set({ playbackMode: mode }),

  startRecording: () => {
    const { recordedFrames, maxFramesEstimate } = get()
    const state = useAudioStore.getState()
    const currentMode = useModeStore.getState().currentMode

    const availableBytes = getAvailableMemory()
    const maxFrames = calculateMaxFrames(availableBytes, currentMode, true)

    set({
      isRecording: true,
      isPlaying: false,
      isPaused: false,
      currentFrame: 0,
      totalFrames: 0,
      recordedFrames: [],
      markedStart: null,
      markedEnd: null,
      maxFramesEstimate: maxFrames,
      playbackMode: 'live'
    })

    console.log(`Recording started. Estimated max frames: ${maxFrames} (~${Math.floor(maxFrames / 60)}s at 60fps)`)
  },

  stopRecording: () => {
    const { recordedFrames, isRecording } = get()
    if (!isRecording) return

    const duration = recordedFrames.length > 0
      ? (recordedFrames[recordedFrames.length - 1].timestamp - recordedFrames[0].timestamp) / 1000
      : 0

    set({
      isRecording: false,
      totalFrames: recordedFrames.length,
      playbackMode: recordedFrames.length > 0 ? 'paused' : 'live'
    })

    console.log(`Recording stopped. ${recordedFrames.length} frames captured (~${duration.toFixed(1)}s)`)
  },

  toggleRecording: () => {
    const { isRecording } = get()
    if (isRecording) {
      get().stopRecording()
    } else {
      get().startRecording()
    }
  },

  startPlayback: () => {
    const { recordedFrames, isRecording } = get()
    if (isRecording || recordedFrames.length === 0) return

    set({
      isPlaying: true,
      isPaused: false,
      currentFrame: 0,
      playbackMode: 'playback'
    })
  },

  pausePlayback: () => {
    const { isPlaying, isPaused } = get()
    if (!isPlaying) return

    set({
      isPaused: !isPaused,
      playbackMode: isPaused ? 'playback' : 'paused'
    })
  },

  stopPlayback: () => {
    set({
      isPlaying: false,
      isPaused: false,
      currentFrame: 0,
      playbackMode: 'live'
    })
  },

  seekToFrame: (frame) => {
    const { recordedFrames, isPlaying, playbackMode } = get()
    if (recordedFrames.length === 0) return

    const clampedFrame = Math.max(0, Math.min(frame, recordedFrames.length - 1))
    set({ currentFrame: clampedFrame })

    if (isPlaying && playbackMode !== 'live') {
      set({ playbackMode: 'paused' })
    }
  },

  seekToProgress: (progress) => {
    const { recordedFrames } = get()
    if (recordedFrames.length === 0) return

    const frame = Math.floor(progress * (recordedFrames.length - 1))
    get().seekToFrame(frame)
  },

  markSegmentStart: () => {
    const { recordedFrames, currentFrame } = get()
    if (recordedFrames.length === 0) return

    set({ markedStart: currentFrame })
    console.log(`Segment start marked at frame ${currentFrame}`)
  },

  markSegmentEnd: () => {
    const { recordedFrames, currentFrame, markedStart } = get()
    if (recordedFrames.length === 0) return

    const end = Math.max(markedStart || 0, currentFrame)
    set({ markedEnd: end, markedStart: markedStart ?? 0 })
    console.log(`Segment end marked at frame ${end}`)
  },

  clearMarkedSegment: () => {
    set({ markedStart: null, markedEnd: null })
  },

  getMarkedSegment: () => {
    const { markedStart, markedEnd, recordedFrames } = get()
    if (markedStart === null || markedEnd === null || recordedFrames.length === 0) {
      return null
    }
    const start = Math.min(markedStart, markedEnd)
    const end = Math.max(markedStart, markedEnd)
    return recordedFrames.slice(start, end + 1)
  },

  getCurrentFrame: () => {
    const { recordedFrames, currentFrame } = get()
    if (recordedFrames.length === 0) return null
    return recordedFrames[currentFrame] || null
  },

  getNextFrame: () => {
    const { recordedFrames, currentFrame } = get()
    if (recordedFrames.length === 0) return null
    if (currentFrame >= recordedFrames.length - 1) return recordedFrames[currentFrame]
    return recordedFrames[currentFrame + 1]
  },

  getPreviousFrame: () => {
    const { recordedFrames, currentFrame } = get()
    if (recordedFrames.length === 0) return null
    if (currentFrame <= 0) return recordedFrames[0]
    return recordedFrames[currentFrame - 1]
  },

  advanceFrame: () => {
    const { recordedFrames, currentFrame, isPlaying } = get()
    if (!isPlaying || recordedFrames.length === 0) return

    if (currentFrame >= recordedFrames.length - 1) {
      get().stopPlayback()
      return
    }
    set({ currentFrame: currentFrame + 1 })
  },

  getProgress: () => {
    const { recordedFrames, currentFrame } = get()
    if (recordedFrames.length === 0) return 0
    return currentFrame / (recordedFrames.length - 1)
  },

  getFormattedTime: () => {
    const { recordedFrames, currentFrame, maxFramesEstimate } = get()
    const fps = recordedFrames.length > 1
      ? (recordedFrames.length - 1) / ((recordedFrames[recordedFrames.length - 1].timestamp - recordedFrames[0].timestamp) / 1000)
      : 60

    const currentSeconds = currentFrame / fps
    const totalSeconds = (recordedFrames.length || maxFramesEstimate) / fps

    const formatTime = (s) => {
      const mins = Math.floor(s / 60)
      const secs = Math.floor(s % 60)
      const ms = Math.floor((s % 1) * 100)
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
    }

    return {
      current: formatTime(currentSeconds),
      total: formatTime(totalSeconds),
      fps: fps.toFixed(1)
    }
  },

  getRecordingStats: () => {
    const { recordedFrames, maxFramesEstimate } = get()
    const usedMB = recordedFrames.length > 0
      ? (recordedFrames.length * estimateFrameSize('default', true)) / (1024 * 1024)
      : 0

    return {
      frameCount: recordedFrames.length,
      maxFrames: maxFramesEstimate,
      usedMB: usedMB.toFixed(1),
      capacityMB: (maxFramesEstimate * estimateFrameSize('default', true)) / (1024 * 1024)
    }
  },

  clearRecording: () => {
    set({
      recordedFrames: [],
      currentFrame: 0,
      totalFrames: 0,
      markedStart: null,
      markedEnd: null,
      isPlaying: false,
      isPaused: false,
      playbackMode: 'live'
    })
  }
}))

import { useAudioStore } from './audioStore'
import { useModeStore } from './modeStore'
