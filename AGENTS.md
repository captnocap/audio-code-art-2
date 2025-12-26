# AGENTS.md - AudioCanvasPro Development Guide

This document provides guidelines for AI agents working on the AudioCanvasPro codebase.

## Build Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

The project uses Vite with React. No test or lint commands are configured. Run `npm run dev` to start the development server on port 3000.

## Code Style Guidelines

### File Naming and Extensions

- React components: `.jsx` extension (e.g., `SceneManager.jsx`, `App.jsx`)
- Non-component JavaScript: `.js` extension (e.g., `audioStore.js`, `modeStore.js`)
- Use PascalCase for component files, camelCase for non-component files
- Keep files under 200 lines when possible; refactor into smaller modules

### Imports and Module Organization

```javascript
// Standard import order
import { create } from 'zustand'                    // 1. External dependencies
import { useFrame, useThree } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'

import { useAudioStore } from '../stores/audioStore' // 2. Relative imports (stores)
import SceneManager from '../renderer/SceneManager'   // 3. Relative imports (components)

import * as THREE from 'three'                       // 4. Namespace imports
```

- Use named imports for libraries: `import { useState, useEffect } from 'react'`
- Use default imports for components: `import SceneManager from './renderer/SceneManager'`
- Avoid barrel exports; import directly from source files
- Relative imports should use `..` for parent directories, `./` for same directory

### Naming Conventions

- **Variables/functions**: camelCase (`audioSource`, `getAudioData`)
- **Constants**: SCREAMING_SNAKE_CASE (`const AUDIO_SOURCE_KEY = 'audio-canvas-source'`)
- **React components**: PascalCase (`SceneManager`, `AudioInitPrompt`)
- **Zustand stores**: `use*Store` pattern (`useAudioStore`, `useModeStore`)
- **Custom hooks**: `use*` prefix (`useAudioCSS`, `useEdgeProximity`)
- **Booleans**: prefix with `is`, `has`, `can` (`isInitialized`, `hasAudio`)
- **Event handlers**: `on*` prefix (`onInit`, `onBeat`)

### React Patterns

```jsx
// Use hooks at top level, not inside conditions
export default function SceneManager() {
  const currentMode = useModeStore(s => s.currentMode)
  const getAudioData = useAudioStore(s => s.getAudioData)

  useFrame(() => {
    // Frame logic
  })

  if (!ModeComponent) return null

  return <ModeComponent audioContext={audioContextRef.current} />
}

// Subscribe to specific store slices to prevent unnecessary re-renders
const { isInitialized, initialize } = useAudioStore()
```

- Use functional components with hooks
- Prefer `useCallback` and `useMemo` for expensive computations
- Access store state with selectors: `useStore(s => s.specificProperty)`
- Use `useRef` for mutable values that don't trigger re-renders
- Handle null/undefined returns early in render

### Error Handling

```javascript
// Always wrap async operations in try/catch
try {
  const pipeline = new AudioPipeline()
  await pipeline.init()
  success = await pipeline.startMicrophone()
} catch (err) {
  console.error('Failed to initialize audio:', err)
}

// Provide safe fallbacks for optional values
const safe = (val) => (typeof val === 'number' && isFinite(val)) ? val : 0

// Use guard clauses for validation
if (!pipeline || !isInitialized) {
  return defaultValues
}
```

- Wrap async operations in try/catch with descriptive error messages
- Provide fallback values for potentially undefined data
- Use guard clauses for early returns instead of nested conditionals
- Log errors with context: `console.error('Failed to initialize audio:', err)`

### Audio and Animation

```javascript
// Audio data access in useFrame
useFrame(() => {
  const data = getAudioData()
  audioContextRef.current = {
    bass: data.bass,
    mid: data.mid,
    high: data.high,
    // ...
  }
})

// Safe audio values with defaults
const defaults = {
  bass: 0, mid: 0, high: 0, amplitude: 0,
  beat: 0, beatPulse: 0, lfo1: 0, lfo2: 0,
  envelope: 0, centroid: 0, dominantFrequency: 0
}
```

- Get audio data in `useFrame` loop for smooth animation
- Always provide default values when audio pipeline isn't initialized
- Use `safe()` helper to ensure finite numeric values
- Audio context ref should persist across renders for performance

### State Management (Zustand)

```javascript
export const useAudioStore = create((set, get) => ({
  isInitialized: false,
  audioSource: 'tab',

  setAudioSource: (source) => {
    if (source === 'tab' || source === 'mic') {
      set({ audioSource: source })
    }
  },

  getAudioData: () => {
    const { pipeline, isInitialized } = get()
    if (!pipeline || !isInitialized) return defaults
    return pipeline.analyze()
  }
}))
```

- Create stores with `create()` from zustand
- Use `set()` to update state, `get()` to access current state
- Keep store logic self-contained; avoid external dependencies
- Persist important state to localStorage for persistence

### Tailwind CSS v4

```jsx
// Use Tailwind utility classes
<div className="fixed bottom-20 left-4 z-50 flex gap-2">
  <button className="px-3 py-1.5 text-xs bg-black/80 text-white rounded border border-white/20 hover:bg-white/20 transition-colors">
    Reset
  </button>
</div>

// Custom theme colors available
<div className="bg-viz-bg text-viz-accent">
```

- Use Tailwind v4 with PostCSS plugin
- Custom colors defined in CSS variables: `viz-bg`, `viz-panel`, `viz-accent`, `viz-glow`
- Use `backdrop-blur` for glassmorphism effects
- Keep utility classes inline rather than extracting to CSS classes

### Mode System

Modes are visualization plugins defined in `src/modes/` with corresponding entries in `modeStore.js`. Each mode requires:
- Component file in `src/modes/` (JSX)
- Definition in `modeStore.js` with `name`, `description`, `component`, `orbitControls`, and `params`
- Parameters support `number` and `expression` types

## Project Structure

```
src/
├── components/     # Reusable React components
├── config/         # Configuration files
├── core/           # Core logic (AudioPipeline, ExpressionEngine)
├── effects/        # Audio/visual effects
├── hooks/          # Custom React hooks
├── modes/          # Visualization mode plugins
├── renderer/       # Scene management (SceneManager)
├── stores/         # Zustand state stores
└── ui/             # UI components (buttons, panels)
```

## General Principles

- Keep components focused on single responsibility
- Extract reusable logic into custom hooks
- Use performance optimizations (refs, memo) for animation loops
- Ensure audio visualization degrades gracefully without audio input
- Test with both microphone and tab-capture audio sources
