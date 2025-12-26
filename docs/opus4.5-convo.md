Here's the architecture:

**Core Stack**
- Three.js + custom GLSL shaders stacked on an image/video texture
- WebGL for GPU-accelerated real-time processing

**The Pipeline**
1. Media (image/video/webcam) → loaded as WebGL texture
2. Texture passes through a chain of fragment shaders
3. Each effect = one shader pass
4. Effects are composable and reorderable (output of one feeds next)
5. Final framebuffer → canvas → export to GIF/WEBM/JPG

**Key Effects Breakdown** (what the shaders actually do):
- **Datamosh**: Fakes p-frame dropping by holding previous frame's motion vectors, blending them incorrectly
- **Optical Flow**: Calculates motion between frames, displaces pixels along those vectors
- **Feedback**: Reads previous frame, applies transform (scale/rotate/hue shift), blends with current
- **Pixel Sort**: Threshold luminance, sort pixels in scanlines
- **Glitch effects**: Deliberate UV coordinate displacement, channel splitting, slice offsets

**Why it's fast**: Everything stays on GPU. Video frames upload as textures, shaders process in parallel, no CPU-side pixel manipulation.

---

For Audio Canvas, you could absolutely steal this architecture. Your audio data is already driving parameters—you could pipe those same values into shader uniforms instead of (or alongside) Canvas 2D. Imagine your blast beat detection triggering UV displacement intensity, or frequency bands controlling chromatic aberration strength.

Want to prototype a shader-based mode? Three.js with a plane + ShaderMaterial watching audio uniforms is like 50 lines to get running.

---

Oh that's *sick*. Full immersion mode — the viz owns the screen, UI ghosts in only when you need it.

So the mental model is:

```
                    ┌─────────────────────────────────────┐
                    │ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢  2D/3D modes      │ ← peek on approach
┌──────┐            │                                     │            ┌──────┐
│ ▢▢▢  │            │                                     │            │ ▢▢▢  │
│ ▢▢▢  │ ← exp.     │         FULL PAGE CANVAS            │   games → │ ▢▢▢  │
│ ▢▢▢  │            │                                     │            │ ▢▢▢  │
│ ▢▢▢  │            │                                     │            │ ▢▢▢  │
└──────┘            │                                     │            └──────┘
                    ├─────────────────────────────────────┤
                    │  DOCK (pinnable or auto-hide)       │
                    └─────────────────────────────────────┘
```

**Three visibility states:**
1. **Hidden** — mouse idle, nothing near edges
2. **Peek** — mouse approaching edge, icons show as dim outlines / subtle glow
3. **Active** — mouse directly over, full opacity + interaction

Let me build this:Built it. Here's what you get:

**Edge behavior:**
- **Left edge** → Experimental modes (Corruption, Feedback Loop, Hallucination)
- **Top edge** → 2D/3D modes (Flow, Wormhole, Nebula, Geometry, etc.)
- **Right edge** → Game modes (Tetris, Racer, Minesweeper)
- **Bottom edge** → Dock with controls

**Three visibility states:**
1. **Hidden** — nothing visible, mouse idle or away from edges
2. **Peek** — 30% opacity, scaled down slightly, shows something's there
3. **Active** — full opacity, interactive

**Dock features:**
- Pinnable (📌 button) — stays visible even when mouse moves away
- Collapsed state shows: mode name, mini audio meters, transport buttons
- Expanded state shows: group tabs on left, param controls in grid, quick actions on right
- Auto-hides after 2 seconds of mouse inactivity

**What I'd refine next:**
- The 25x25 icons are pretty small — might want 32x32 for touch targets
- Could add keyboard shortcuts (1-9 for modes, space for play, etc.)
- The peek → active transition could use a slight delay to prevent accidental triggers
- Drag handle on dock for manual height adjustment

Want me to add any of those, or tweak the layout/sizing?

---

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * Immersive Visualizer UI
 * 
 * Full-page canvas with edge-based mode selectors that auto-hide:
 * - LEFT: Experimental modes
 * - TOP: 2D/3D modes  
 * - RIGHT: Game modes
 * - BOTTOM: Dock (pinnable)
 * 
 * Three states: hidden → peek → active
 */

// ============================================================================
// Types & Data
// ============================================================================

type ModeCategory = "experimental" | "2d3d" | "game";

type Mode = {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: ModeCategory;
  color?: string;
};

type ParamDef = {
  id: string;
  label: string;
  type: "float" | "bool" | "color" | "enum";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  default: any;
};

type ModeConfig = {
  id: string;
  name: string;
  groups: { name: string; params: ParamDef[] }[];
};

// Icon components (simple SVG placeholders - replace with your actual icons)
const IconFlow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 12c2-4 6-4 8 0s6 4 8 0" />
    <path d="M4 8c2-4 6-4 8 0s6 4 8 0" opacity="0.5" />
    <path d="M4 16c2-4 6-4 8 0s6 4 8 0" opacity="0.5" />
  </svg>
);

const IconWormhole = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="6" opacity="0.7" />
    <circle cx="12" cy="12" r="3" opacity="0.4" />
  </svg>
);

const IconNebula = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="10" r="4" opacity="0.6" />
    <circle cx="14" cy="12" r="5" opacity="0.8" />
    <circle cx="16" cy="8" r="3" opacity="0.4" />
  </svg>
);

const IconGeometry = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="12,3 21,18 3,18" />
  </svg>
);

const IconMycelium = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 20V12M12 12L6 6M12 12L18 6M12 12L8 16M12 12L16 16" />
  </svg>
);

const IconConway = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="4" width="4" height="4" fill="currentColor" opacity="0.8" />
    <rect x="10" y="4" width="4" height="4" fill="currentColor" opacity="0.4" />
    <rect x="4" y="10" width="4" height="4" fill="currentColor" opacity="0.6" />
    <rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.9" />
    <rect x="16" y="10" width="4" height="4" fill="currentColor" opacity="0.3" />
    <rect x="10" y="16" width="4" height="4" fill="currentColor" opacity="0.5" />
  </svg>
);

const IconTetris = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="8" y="4" width="4" height="4" fill="currentColor" />
    <rect x="8" y="8" width="4" height="4" fill="currentColor" />
    <rect x="8" y="12" width="4" height="4" fill="currentColor" />
    <rect x="12" y="12" width="4" height="4" fill="currentColor" />
  </svg>
);

const IconRacer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 20L12 4L20 20" />
    <path d="M8 14h8" />
  </svg>
);

const IconMinesweeper = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="6" />
    <path d="M12 6V3M12 21v-3M6 12H3M21 12h-3M7.76 7.76L5.64 5.64M18.36 18.36l-2.12-2.12M7.76 16.24l-2.12 2.12M18.36 5.64l-2.12 2.12" />
  </svg>
);

const IconCorruption = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 8h16M4 12h10M8 16h12" strokeDasharray="2 2" />
    <rect x="14" y="10" width="6" height="6" fill="currentColor" opacity="0.3" />
  </svg>
);

const IconFeedback = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 4v16M4 12h16" />
    <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
  </svg>
);

const IconProtein = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 12c0-3 2-6 6-6s6 3 6 6-2 6-6 6" />
    <circle cx="8" cy="10" r="2" fill="currentColor" />
    <circle cx="14" cy="8" r="1.5" fill="currentColor" opacity="0.6" />
    <circle cx="16" cy="14" r="1.5" fill="currentColor" opacity="0.8" />
  </svg>
);

const IconHallucination = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 4C8 4 4 8 4 12s4 8 8 8" strokeDasharray="3 2" />
    <path d="M12 4c4 0 8 4 8 8s-4 8-8 8" opacity="0.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4" />
  </svg>
);

// Sample modes - replace with your actual modes
const MODES: Mode[] = [
  // 2D/3D modes (top)
  { id: "flow", name: "Flow Field", icon: <IconFlow />, category: "2d3d", color: "#4fd8ff" },
  { id: "wormhole", name: "Wormhole", icon: <IconWormhole />, category: "2d3d", color: "#ff4fd8" },
  { id: "nebula", name: "Nebula", icon: <IconNebula />, category: "2d3d", color: "#d84fff" },
  { id: "geometry", name: "Geometry", icon: <IconGeometry />, category: "2d3d", color: "#4fffb8" },
  { id: "mycelium", name: "Mycelium", icon: <IconMycelium />, category: "2d3d", color: "#b8ff4f" },
  { id: "conway", name: "Conway", icon: <IconConway />, category: "2d3d", color: "#ff8c4f" },
  { id: "protein", name: "Protein", icon: <IconProtein />, category: "2d3d", color: "#4f8cff" },
  
  // Experimental modes (left)
  { id: "corruption", name: "Corruption", icon: <IconCorruption />, category: "experimental", color: "#ff4f4f" },
  { id: "feedback", name: "Feedback Loop", icon: <IconFeedback />, category: "experimental", color: "#ffb84f" },
  { id: "hallucination", name: "Hallucination", icon: <IconHallucination />, category: "experimental", color: "#b84fff" },
  
  // Game modes (right)
  { id: "tetris", name: "Audio Tetris", icon: <IconTetris />, category: "game", color: "#4fffef" },
  { id: "racer", name: "Highway Racer", icon: <IconRacer />, category: "game", color: "#ef4fff" },
  { id: "minesweeper", name: "Minesweeper", icon: <IconMinesweeper />, category: "game", color: "#ffef4f" },
];

// Sample mode config for dock
const MODE_CONFIGS: Record<string, ModeConfig> = {
  flow: {
    id: "flow",
    name: "Flow Field",
    groups: [
      {
        name: "Field",
        params: [
          { id: "speed", label: "Speed", type: "float", min: 0, max: 2, step: 0.01, default: 0.8 },
          { id: "scale", label: "Scale", type: "float", min: 0.1, max: 5, step: 0.1, default: 1.5 },
          { id: "turbulence", label: "Turbulence", type: "float", min: 0, max: 1, step: 0.01, default: 0.3 },
        ],
      },
      {
        name: "Particles",
        params: [
          { id: "count", label: "Count", type: "float", min: 100, max: 10000, step: 100, default: 3000 },
          { id: "size", label: "Size", type: "float", min: 0.5, max: 4, step: 0.1, default: 1.2 },
          { id: "trail", label: "Trail", type: "bool", default: true },
        ],
      },
      {
        name: "Color",
        params: [
          { id: "palette", label: "Palette", type: "enum", options: ["Spectral", "Vapor", "Fire", "Ocean"], default: "Vapor" },
          { id: "tint", label: "Tint", type: "color", default: "#4fd8ff" },
        ],
      },
    ],
  },
  wormhole: {
    id: "wormhole",
    name: "Wormhole",
    groups: [
      {
        name: "Motion",
        params: [
          { id: "forward", label: "Forward Speed", type: "float", min: 0, max: 5, step: 0.1, default: 1.8 },
          { id: "rotation", label: "Rotation", type: "float", min: -2, max: 2, step: 0.01, default: 0.3 },
        ],
      },
      {
        name: "Geometry",
        params: [
          { id: "rings", label: "Rings", type: "float", min: 10, max: 200, step: 1, default: 80 },
          { id: "segments", label: "Segments", type: "float", min: 8, max: 64, step: 1, default: 32 },
        ],
      },
      {
        name: "FX",
        params: [
          { id: "bloom", label: "Bloom", type: "float", min: 0, max: 2, step: 0.01, default: 0.8 },
          { id: "feedback", label: "Feedback", type: "float", min: 0, max: 0.99, step: 0.01, default: 0.85 },
        ],
      },
    ],
  },
};

// Get config for a mode, fallback to a generic one
function getModeConfig(modeId: string): ModeConfig {
  return MODE_CONFIGS[modeId] ?? {
    id: modeId,
    name: MODES.find(m => m.id === modeId)?.name ?? modeId,
    groups: [
      {
        name: "Parameters",
        params: [
          { id: "intensity", label: "Intensity", type: "float", min: 0, max: 1, step: 0.01, default: 0.5 },
          { id: "speed", label: "Speed", type: "float", min: 0, max: 2, step: 0.01, default: 1.0 },
          { id: "reactive", label: "Audio Reactive", type: "bool", default: true },
        ],
      },
    ],
  };
}

// ============================================================================
// Hooks
// ============================================================================

type EdgeProximity = {
  left: "hidden" | "peek" | "active";
  top: "hidden" | "peek" | "active";
  right: "hidden" | "peek" | "active";
  bottom: "hidden" | "peek" | "active";
};

function useEdgeProximity(peekThreshold = 80, activeThreshold = 40): EdgeProximity {
  const [proximity, setProximity] = useState<EdgeProximity>({
    left: "hidden",
    top: "hidden",
    right: "hidden",
    bottom: "hidden",
  });
  
  const lastMoveTime = useRef(Date.now());
  const hideTimeoutRef = useRef<number | null>(null);

  const updateProximity = useCallback((e: MouseEvent) => {
    lastMoveTime.current = Date.now();
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    const x = e.clientX;
    const y = e.clientY;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const getState = (dist: number): "hidden" | "peek" | "active" => {
      if (dist < activeThreshold) return "active";
      if (dist < peekThreshold) return "peek";
      return "hidden";
    };

    setProximity({
      left: getState(x),
      top: getState(y),
      right: getState(w - x),
      bottom: getState(h - y),
    });

    // Auto-hide after inactivity
    hideTimeoutRef.current = window.setTimeout(() => {
      setProximity({ left: "hidden", top: "hidden", right: "hidden", bottom: "hidden" });
    }, 2000);
  }, [peekThreshold, activeThreshold]);

  useEffect(() => {
    window.addEventListener("mousemove", updateProximity);
    return () => {
      window.removeEventListener("mousemove", updateProximity);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [updateProximity]);

  return proximity;
}

function useParamState(config: ModeConfig) {
  const initial = React.useMemo(() => {
    const o: Record<string, any> = {};
    for (const g of config.groups) {
      for (const p of g.params) {
        o[p.id] = p.default;
      }
    }
    return o;
  }, [config.id]);

  const [state, setState] = useState(initial);

  useEffect(() => {
    setState(initial);
  }, [config.id]);

  const set = (id: string, value: any) => setState(s => ({ ...s, [id]: value }));
  
  return { state, set };
}

// ============================================================================
// Components
// ============================================================================

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

// Mode icon button
function ModeIcon({ 
  mode, 
  isActive, 
  onClick, 
  size = 25,
  visibility 
}: { 
  mode: Mode; 
  isActive: boolean; 
  onClick: () => void;
  size?: number;
  visibility: "hidden" | "peek" | "active";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center justify-center transition-all duration-300",
        "border backdrop-blur-sm",
        visibility === "hidden" && "opacity-0 scale-75 pointer-events-none",
        visibility === "peek" && "opacity-30 scale-90",
        visibility === "active" && "opacity-100 scale-100",
        isActive 
          ? "bg-white/20 border-white/40 shadow-lg" 
          : "bg-black/40 border-white/10 hover:bg-white/10 hover:border-white/20"
      )}
      style={{ 
        width: size, 
        height: size,
        borderRadius: size * 0.2,
        color: isActive ? mode.color : "rgba(255,255,255,0.7)",
      }}
      title={mode.name}
    >
      <div className="w-[60%] h-[60%]">
        {mode.icon}
      </div>
      
      {/* Tooltip */}
      <div className={cn(
        "absolute whitespace-nowrap px-2 py-1 rounded text-[10px] font-medium",
        "bg-black/80 border border-white/10 text-white/90",
        "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50",
        // Position based on which edge
        mode.category === "experimental" && "left-full ml-2",
        mode.category === "2d3d" && "top-full mt-2",
        mode.category === "game" && "right-full mr-2",
      )}>
        {mode.name}
      </div>
      
      {/* Active indicator glow */}
      {isActive && (
        <div 
          className="absolute inset-0 rounded-[inherit] opacity-50 blur-sm -z-10"
          style={{ backgroundColor: mode.color }}
        />
      )}
    </button>
  );
}

// Edge mode strip
function EdgeStrip({
  modes,
  activeMode,
  onModeSelect,
  position,
  visibility,
}: {
  modes: Mode[];
  activeMode: string;
  onModeSelect: (id: string) => void;
  position: "left" | "top" | "right";
  visibility: "hidden" | "peek" | "active";
}) {
  const isVertical = position === "left" || position === "right";
  
  return (
    <div
      className={cn(
        "fixed flex gap-1 p-1 transition-all duration-300",
        "bg-black/20 backdrop-blur-md border border-white/5 rounded-lg",
        isVertical ? "flex-col" : "flex-row",
        position === "left" && "left-2 top-1/2 -translate-y-1/2",
        position === "top" && "top-2 left-1/2 -translate-x-1/2",
        position === "right" && "right-2 top-1/2 -translate-y-1/2",
        visibility === "hidden" && "opacity-0 pointer-events-none",
        visibility === "peek" && "opacity-40",
        visibility === "active" && "opacity-100",
      )}
      style={{
        transform: cn(
          position === "left" && (visibility === "hidden" ? "translateX(-100%) translateY(-50%)" : "translateY(-50%)"),
          position === "right" && (visibility === "hidden" ? "translateX(100%) translateY(-50%)" : "translateY(-50%)"),
          position === "top" && (visibility === "hidden" ? "translateY(-100%) translateX(-50%)" : "translateX(-50%)"),
        ) || undefined,
      }}
    >
      {modes.map(mode => (
        <ModeIcon
          key={mode.id}
          mode={mode}
          isActive={activeMode === mode.id}
          onClick={() => onModeSelect(mode.id)}
          visibility={visibility}
        />
      ))}
    </div>
  );
}

// Parameter control
function ParamControl({ 
  param, 
  value, 
  onChange 
}: { 
  param: ParamDef; 
  value: any; 
  onChange: (v: any) => void;
}) {
  if (param.type === "bool") {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-white/70">{param.label}</span>
        <button
          onClick={() => onChange(!value)}
          className={cn(
            "w-8 h-4 rounded-full transition-colors relative",
            value ? "bg-white/30" : "bg-white/10"
          )}
        >
          <div className={cn(
            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
            value ? "left-4" : "left-0.5"
          )} />
        </button>
      </div>
    );
  }

  if (param.type === "color") {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-white/70">{param.label}</span>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
        />
      </div>
    );
  }

  if (param.type === "enum") {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-white/70">{param.label}</span>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/80"
        >
          {param.options?.map(opt => (
            <option key={opt} value={opt} className="bg-black">{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  // float
  const min = param.min ?? 0;
  const max = param.max ?? 1;
  const step = param.step ?? 0.01;
  const numValue = Number(value) || param.default;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/70">{param.label}</span>
        <span className="text-[10px] text-white/50 font-mono">{numValue.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numValue}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-white/10 
          [&::-webkit-slider-thumb]:appearance-none 
          [&::-webkit-slider-thumb]:w-3 
          [&::-webkit-slider-thumb]:h-3 
          [&::-webkit-slider-thumb]:rounded-full 
          [&::-webkit-slider-thumb]:bg-white/80
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-white"
      />
    </div>
  );
}

// Bottom Dock
function Dock({
  activeMode,
  visibility,
  pinned,
  onPinToggle,
  audioLevels,
}: {
  activeMode: string;
  visibility: "hidden" | "peek" | "active";
  pinned: boolean;
  onPinToggle: () => void;
  audioLevels: { bass: number; mid: number; high: number; beat: number };
}) {
  const config = getModeConfig(activeMode);
  const { state, set } = useParamState(config);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const mode = MODES.find(m => m.id === activeMode);

  const effectiveVisibility = pinned ? "active" : visibility;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 transition-all duration-300",
        "bg-black/60 backdrop-blur-xl border-t border-white/10",
        effectiveVisibility === "hidden" && "translate-y-full opacity-0",
        effectiveVisibility === "peek" && "translate-y-[calc(100%-32px)] opacity-60",
        effectiveVisibility === "active" && "translate-y-0 opacity-100",
      )}
    >
      {/* Peek bar (always visible in peek state) */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Mode indicator */}
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: mode?.color ?? "#fff" }}
            />
            <span className="text-[11px] font-medium text-white/80">{config.name}</span>
          </div>
          
          {/* Mini audio meters */}
          <div className="flex items-center gap-1">
            {Object.entries(audioLevels).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[9px] text-white/40 uppercase w-4">{key[0]}</span>
                <div className="w-8 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-white/40 transition-all duration-75"
                    style={{ width: `${val * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Transport */}
          <div className="flex items-center gap-1">
            <button className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/70 text-xs">▶</button>
            <button className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/70 text-xs">⏺</button>
            <button className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/70 text-xs">⬇</button>
          </div>
          
          {/* Pin button */}
          <button
            onClick={onPinToggle}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded text-xs transition-colors",
              pinned ? "bg-white/20 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"
            )}
            title={pinned ? "Unpin dock" : "Pin dock"}
          >
            📌
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <div className="p-4">
        <div className="flex gap-4 max-w-4xl mx-auto">
          {/* Group tabs */}
          <div className="w-32 shrink-0 space-y-1">
            {config.groups.map((group, i) => (
              <button
                key={group.name}
                onClick={() => setSelectedGroup(i)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-left text-[11px] font-medium transition-colors",
                  selectedGroup === i 
                    ? "bg-white/15 text-white" 
                    : "text-white/50 hover:text-white/70 hover:bg-white/5"
                )}
              >
                {group.name}
              </button>
            ))}
            
            {/* FX and Mod Matrix stubs */}
            <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
              <button className="w-full px-3 py-2 rounded-lg text-left text-[11px] text-white/40 hover:text-white/60 hover:bg-white/5">
                FX Stack
              </button>
              <button className="w-full px-3 py-2 rounded-lg text-left text-[11px] text-white/40 hover:text-white/60 hover:bg-white/5">
                Mod Matrix
              </button>
            </div>
          </div>

          {/* Params */}
          <div className="flex-1 grid grid-cols-3 gap-x-6 gap-y-1">
            {config.groups[selectedGroup]?.params.map(param => (
              <ParamControl
                key={param.id}
                param={param}
                value={state[param.id]}
                onChange={v => set(param.id, v)}
              />
            ))}
          </div>

          {/* Quick actions */}
          <div className="w-24 shrink-0 space-y-2">
            <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2">Quick</div>
            <button className="w-full px-2 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[10px] text-white/70">
              Randomize
            </button>
            <button className="w-full px-2 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[10px] text-white/70">
              Reset
            </button>
            <button className="w-full px-2 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[10px] text-white/70">
              Save Preset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fake canvas background for demo
function FakeVisualization({ activeMode }: { activeMode: string }) {
  const mode = MODES.find(m => m.id === activeMode);
  
  return (
    <div 
      className="fixed inset-0 -z-10"
      style={{
        background: `
          radial-gradient(ellipse at 30% 20%, ${mode?.color ?? '#4fd8ff'}22 0%, transparent 50%),
          radial-gradient(ellipse at 70% 60%, ${mode?.color ?? '#ff4fd8'}15 0%, transparent 40%),
          radial-gradient(ellipse at 50% 90%, ${mode?.color ?? '#4fff88'}10 0%, transparent 30%),
          linear-gradient(to bottom, #0a0a0f, #12121a)
        `,
      }}
    >
      {/* Animated noise overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Center glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: mode?.color }}
      />
      
      {/* Mode name watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
        <div className="text-6xl font-bold text-white/[0.03] tracking-widest uppercase">
          {mode?.name}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function ImmersiveVisualizerUI() {
  const [activeMode, setActiveMode] = useState("flow");
  const [dockPinned, setDockPinned] = useState(false);
  const proximity = useEdgeProximity(100, 50);
  
  // Fake audio levels for demo
  const [audioLevels, setAudioLevels] = useState({ bass: 0.5, mid: 0.3, high: 0.2, beat: 0 });
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevels({
        bass: 0.3 + Math.random() * 0.5,
        mid: 0.2 + Math.random() * 0.4,
        high: 0.1 + Math.random() * 0.3,
        beat: Math.random() > 0.85 ? 1 : 0,
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const experimentalModes = MODES.filter(m => m.category === "experimental");
  const modes2d3d = MODES.filter(m => m.category === "2d3d");
  const gameModes = MODES.filter(m => m.category === "game");

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background visualization */}
      <FakeVisualization activeMode={activeMode} />

      {/* Edge strips */}
      <EdgeStrip
        modes={experimentalModes}
        activeMode={activeMode}
        onModeSelect={setActiveMode}
        position="left"
        visibility={proximity.left}
      />
      
      <EdgeStrip
        modes={modes2d3d}
        activeMode={activeMode}
        onModeSelect={setActiveMode}
        position="top"
        visibility={proximity.top}
      />
      
      <EdgeStrip
        modes={gameModes}
        activeMode={activeMode}
        onModeSelect={setActiveMode}
        position="right"
        visibility={proximity.right}
      />

      {/* Dock */}
      <Dock
        activeMode={activeMode}
        visibility={proximity.bottom}
        pinned={dockPinned}
        onPinToggle={() => setDockPinned(p => !p)}
        audioLevels={audioLevels}
      />

      {/* Instructions overlay (remove in production) */}
      <div className="fixed top-4 right-4 p-3 rounded-lg bg-black/40 backdrop-blur border border-white/10 text-[11px] text-white/60 max-w-xs pointer-events-none">
        <div className="font-semibold text-white/80 mb-1">How it works:</div>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Move mouse to edges to reveal mode strips</li>
          <li>Move to bottom for dock</li>
          <li>Click 📌 to pin dock open</li>
          <li>Everything auto-hides after 2s of inactivity</li>
        </ul>
      </div>
    </div>
  );
}

---

Ah, the **feature tour / onboarding spotlight** pattern. Classic.

The trick is:
1. **Dim + blur** the whole page
2. **Cut a hole** around the target element (box-shadow trick or SVG mask)
3. **Tooltip** with arrow pointing at the spotlight
4. **Step through** with Next/Skip
5. **localStorage** flag so it only shows once

Let me build it:Done. Here's what you get:

**The spotlight effect:**
- Box-shadow trick — the spotlight div has `box-shadow: 0 0 0 9999px rgba(0,0,0,0.8)` which creates a "hole" while dimming everything else
- Backdrop blur on the overlay
- Animated pulsing border around the spotlight area
- Smooth transitions as it moves between regions

**Step system:**
```typescript
{
  id: "dock",
  title: "The Dock",
  description: "Move to the bottom for the control dock...",
  region: { type: "edge", edge: "bottom", padding: 40 },
  tooltipPosition: "top",  // tooltip appears above the spotlight
}
```

**Navigation:**
- Progress dots showing where you are
- Back / Next / Skip buttons
- Keyboard: `→` next, `←` back, `Esc` skip
- `localStorage` flag so returning users don't see it again

**Integration:**
```tsx
import { OnboardingTour, VISUALIZER_TOUR_STEPS, useTour } from "./onboarding-tour";

// In your app:
const { showTour, setShowTour, startTour } = useTour();

{showTour && (
  <OnboardingTour
    steps={VISUALIZER_TOUR_STEPS}
    onComplete={() => setShowTour(false)}
    onSkip={() => setShowTour(false)}
  />
)}

// Settings menu can have "Restart Tour" button:
<button onClick={startTour}>Show Tutorial</button>
```

**What I'd add next:**
- Animate the actual edge strips to "peek" in when their step is active
- Maybe a little mascot or hand cursor pointing
- Sound effects on step transitions (subtle whoosh)

---

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * Onboarding Tour Component
 * 
 * - Blurs/dims the page
 * - Spotlights UI regions with a "hole" effect
 * - Animated tooltips with descriptions
 * - Step navigation (Next / Skip / keyboard)
 * - localStorage to remember completion
 */

// ============================================================================
// Types
// ============================================================================

type SpotlightRegion = {
  // For edge-based UI, we define regions rather than element refs
  type: "edge" | "rect" | "center";
  edge?: "left" | "top" | "right" | "bottom";
  // Or explicit bounds
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Padding around the region
  padding?: number;
};

type TourStep = {
  id: string;
  title: string;
  description: string;
  region: SpotlightRegion;
  // Where tooltip appears relative to spotlight
  tooltipPosition: "top" | "bottom" | "left" | "right" | "center";
  // Optional: trigger the UI to show (e.g., reveal edge strip)
  triggerVisibility?: () => void;
  // Optional: custom action text
  actionText?: string;
};

type OnboardingTourProps = {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  storageKey?: string;
};

// ============================================================================
// Default tour steps for the visualizer UI
// ============================================================================

export const VISUALIZER_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Audio Canvas",
    description: "Let's take a quick tour of the interface. Everything is designed to stay out of your way until you need it.",
    region: { type: "center" },
    tooltipPosition: "center",
  },
  {
    id: "top-modes",
    title: "2D & 3D Modes",
    description: "Move your mouse to the top edge to reveal visualization modes. Flow fields, wormholes, nebulas, and more.",
    region: { type: "edge", edge: "top", padding: 20 },
    tooltipPosition: "bottom",
  },
  {
    id: "left-modes",
    title: "Experimental Modes",
    description: "The left edge holds experimental and glitchy modes. Corruption, feedback loops, hallucinations — the weird stuff.",
    region: { type: "edge", edge: "left", padding: 20 },
    tooltipPosition: "right",
  },
  {
    id: "right-modes",
    title: "Game Modes",
    description: "Right edge has interactive game modes. Audio-reactive Tetris, highway racer, and more.",
    region: { type: "edge", edge: "right", padding: 20 },
    tooltipPosition: "left",
  },
  {
    id: "dock",
    title: "The Dock",
    description: "Move to the bottom for the control dock. Adjust parameters, see audio levels, record and screenshot. Pin it open with 📌 if you want it to stay.",
    region: { type: "edge", edge: "bottom", padding: 40 },
    tooltipPosition: "top",
  },
  {
    id: "keyboard",
    title: "Keyboard Shortcuts",
    description: "Space to play/pause, R to record, S to screenshot, F for fullscreen, Tab to toggle dock. Numbers 1-9 switch modes.",
    region: { type: "center" },
    tooltipPosition: "center",
  },
  {
    id: "done",
    title: "You're all set!",
    description: "The UI hides after 2 seconds of inactivity. Just move your mouse to bring it back. Now go make something beautiful.",
    region: { type: "center" },
    tooltipPosition: "center",
    actionText: "Let's go",
  },
];

// ============================================================================
// Utilities
// ============================================================================

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function getRegionBounds(region: SpotlightRegion): { x: number; y: number; width: number; height: number } {
  const padding = region.padding ?? 10;
  const w = typeof window !== "undefined" ? window.innerWidth : 1920;
  const h = typeof window !== "undefined" ? window.innerHeight : 1080;

  if (region.type === "center") {
    const size = 300;
    return {
      x: w / 2 - size / 2,
      y: h / 2 - size / 2,
      width: size,
      height: size,
    };
  }

  if (region.type === "edge") {
    const edgeSize = 60; // How far into the screen the edge region extends
    switch (region.edge) {
      case "top":
        return { x: w * 0.2, y: 0, width: w * 0.6, height: edgeSize + padding };
      case "bottom":
        return { x: 0, y: h - 120 - padding, width: w, height: 120 + padding };
      case "left":
        return { x: 0, y: h * 0.25, width: edgeSize + padding, height: h * 0.5 };
      case "right":
        return { x: w - edgeSize - padding, y: h * 0.25, width: edgeSize + padding, height: h * 0.5 };
      default:
        return { x: 0, y: 0, width: 100, height: 100 };
    }
  }

  // Explicit rect
  return {
    x: (region.x ?? 0) - padding,
    y: (region.y ?? 0) - padding,
    width: (region.width ?? 100) + padding * 2,
    height: (region.height ?? 100) + padding * 2,
  };
}

// ============================================================================
// Components
// ============================================================================

function SpotlightOverlay({ 
  bounds, 
  isCenter 
}: { 
  bounds: { x: number; y: number; width: number; height: number };
  isCenter: boolean;
}) {
  // For center, we don't cut a hole — just show a subtle vignette
  if (isCenter) {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none">
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          style={{
            background: "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.85) 70%)",
          }}
        />
      </div>
    );
  }

  // Box-shadow trick to create a "hole"
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Blur layer */}
      <div className="absolute inset-0 backdrop-blur-sm" />
      
      {/* Spotlight hole using box-shadow */}
      <div
        className="absolute transition-all duration-500 ease-out rounded-2xl"
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.80)",
        }}
      />
      
      {/* Animated border around spotlight */}
      <div
        className="absolute transition-all duration-500 ease-out rounded-2xl border-2 border-white/30"
        style={{
          left: bounds.x - 2,
          top: bounds.y - 2,
          width: bounds.width + 4,
          height: bounds.height + 4,
        }}
      >
        {/* Pulse animation */}
        <div className="absolute inset-0 rounded-2xl border-2 border-white/20 animate-ping" />
      </div>
    </div>
  );
}

function Tooltip({
  step,
  bounds,
  currentIndex,
  totalSteps,
  onNext,
  onSkip,
  onPrev,
}: {
  step: TourStep;
  bounds: { x: number; y: number; width: number; height: number };
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onPrev: () => void;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const isCenter = step.region.type === "center";

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  let arrowClass = "";

  if (isCenter) {
    tooltipStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else {
    const gap = 20;
    switch (step.tooltipPosition) {
      case "top":
        tooltipStyle = {
          left: bounds.x + bounds.width / 2,
          top: bounds.y - gap,
          transform: "translate(-50%, -100%)",
        };
        arrowClass = "after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-white/10";
        break;
      case "bottom":
        tooltipStyle = {
          left: bounds.x + bounds.width / 2,
          top: bounds.y + bounds.height + gap,
          transform: "translate(-50%, 0)",
        };
        arrowClass = "after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-b-white/10";
        break;
      case "left":
        tooltipStyle = {
          left: bounds.x - gap,
          top: bounds.y + bounds.height / 2,
          transform: "translate(-100%, -50%)",
        };
        arrowClass = "after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-l-white/10";
        break;
      case "right":
        tooltipStyle = {
          left: bounds.x + bounds.width + gap,
          top: bounds.y + bounds.height / 2,
          transform: "translate(0, -50%)",
        };
        arrowClass = "after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-r-white/10";
        break;
    }
  }

  return (
    <div
      className={cn(
        "fixed z-50 w-80 p-5 rounded-2xl",
        "bg-gradient-to-br from-white/10 to-white/5",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
        arrowClass
      )}
      style={tooltipStyle}
    >
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentIndex 
                  ? "bg-white w-6" 
                  : i < currentIndex 
                    ? "bg-white/50" 
                    : "bg-white/20"
              )}
            />
          ))}
        </div>
        <span className="text-[10px] text-white/40 font-mono">
          {currentIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-white mb-2">
        {step.title}
      </h3>
      <p className="text-sm text-white/70 leading-relaxed">
        {step.description}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10">
        <button
          onClick={onSkip}
          className="text-[11px] text-white/40 hover:text-white/60 transition-colors"
        >
          Skip tour
        </button>
        
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 rounded-lg text-[11px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[11px] font-medium transition-all",
              "bg-white/20 hover:bg-white/30 text-white",
              "border border-white/10"
            )}
          >
            {step.actionText ?? (isLast ? "Finish" : "Next")}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="mt-3 text-[10px] text-white/30 text-center">
        Press <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">→</kbd> for next, 
        <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono ml-1">Esc</kbd> to skip
      </div>
    </div>
  );
}

// ============================================================================
// Main Tour Component
// ============================================================================

export function OnboardingTour({
  steps,
  onComplete,
  onSkip,
  storageKey = "audio-canvas-tour-complete",
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 100, height: 100 });

  const step = steps[currentStep];

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Small delay before showing tour
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  // Update bounds when step changes
  useEffect(() => {
    if (step) {
      setBounds(getRegionBounds(step.region));
      step.triggerVisibility?.();
    }
  }, [step]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (step) {
        setBounds(getRegionBounds(step.region));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      
      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          handleNext();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "Escape":
          handleSkip();
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      // Complete
      localStorage.setItem(storageKey, "true");
      setIsVisible(false);
      onComplete();
    }
  }, [currentStep, steps.length, onComplete, storageKey]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
    onSkip();
  }, [onSkip, storageKey]);

  if (!isVisible || !step) return null;

  const isCenter = step.region.type === "center";

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Overlay with spotlight */}
      <SpotlightOverlay bounds={bounds} isCenter={isCenter} />

      {/* Click blocker (except on the spotlight area for non-center) */}
      <div 
        className="fixed inset-0 z-40"
        onClick={(e) => {
          // Only block clicks outside spotlight
          const rect = { left: bounds.x, top: bounds.y, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height };
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            e.stopPropagation();
          }
        }}
      />

      {/* Tooltip */}
      <Tooltip
        step={step}
        bounds={bounds}
        currentIndex={currentStep}
        totalSteps={steps.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </div>
  );
}

// ============================================================================
// Hook to control tour
// ============================================================================

export function useTour(storageKey = "audio-canvas-tour-complete") {
  const [showTour, setShowTour] = useState(false);

  const startTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setShowTour(true);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const isTourComplete = useCallback(() => {
    return localStorage.getItem(storageKey) === "true";
  }, [storageKey]);

  return { showTour, setShowTour, startTour, resetTour, isTourComplete };
}

// ============================================================================
// Demo wrapper showing integration
// ============================================================================

export default function OnboardingDemo() {
  const { showTour, setShowTour, startTour, isTourComplete } = useTour();
  const [tourComplete, setTourComplete] = useState(false);

  useEffect(() => {
    // Check on mount
    if (!isTourComplete()) {
      setShowTour(true);
    } else {
      setTourComplete(true);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] to-[#12121a]">
      {/* Fake app background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Simulated edge strips (just visual placeholders) */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 flex gap-1 p-1 bg-black/40 backdrop-blur rounded-lg border border-white/10">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-8 h-8 rounded bg-white/10 border border-white/5" />
        ))}
      </div>
      
      <div className="fixed left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1 bg-black/40 backdrop-blur rounded-lg border border-white/10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-8 h-8 rounded bg-white/10 border border-white/5" />
        ))}
      </div>
      
      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1 bg-black/40 backdrop-blur rounded-lg border border-white/10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-8 h-8 rounded bg-white/10 border border-white/5" />
        ))}
      </div>

      {/* Simulated dock */}
      <div className="fixed bottom-0 left-0 right-0 h-28 bg-black/60 backdrop-blur-xl border-t border-white/10">
        <div className="h-8 flex items-center px-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] text-white/70">Flow Field</span>
          </div>
        </div>
        <div className="p-4 flex gap-4">
          <div className="w-24 space-y-1">
            <div className="h-6 rounded bg-white/10" />
            <div className="h-6 rounded bg-white/5" />
            <div className="h-6 rounded bg-white/5" />
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-white/5" />
            ))}
          </div>
        </div>
      </div>

      {/* Tour */}
      {showTour && (
        <OnboardingTour
          steps={VISUALIZER_TOUR_STEPS}
          onComplete={() => {
            setShowTour(false);
            setTourComplete(true);
          }}
          onSkip={() => {
            setShowTour(false);
            setTourComplete(true);
          }}
        />
      )}

      {/* Restart tour button (for demo) */}
      {tourComplete && (
        <button
          onClick={startTour}
          className="fixed top-4 right-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-[12px] text-white/70 transition-colors z-50"
        >
          Restart Tour
        </button>
      )}
    </div>
  );
}


---

Oh this is key for streamers/VJs. Few approaches:

**Simplest: Pop-out clean window**
- New window with JUST the canvas, zero UI
- OBS window-captures it
- Stays in sync because it's reading from the same audio analyzer / state

**Pro: Dedicated capture route**
- `/capture` or `/output` URL that renders canvas only
- Can set exact resolution (1920x1080, 4K, whatever)
- OBS uses Browser Source pointing at that URL

**Nuclear: Spout/Syphon/NDI**
- What Mosh Pro does
- Requires native code / Electron
- Zero-latency texture sharing between apps

Let me build the pop-out approach since it works purely in-browser:Built it. Four approaches, pick your poison:

**1. Pop-out Window** (easiest)
```tsx
const popout = usePopoutCanvas(yourCanvasRef.current);
popout.openPopout({ width: 1920, height: 1080 });
// OBS: Window Capture → "Audio Canvas Output"
```
- Opens clean window, copies frames via `requestAnimationFrame`
- Has fullscreen button, resolution display
- Controls auto-hide

**2. Browser Source URL** (cleanest for OBS)
```
https://yoursite.com/output?resolution=1920x1080
```
- Dedicated route renders ONLY the canvas
- No frame copying overhead — it's running the actual viz
- OBS Browser Source just points at the URL

**3. Picture-in-Picture** (native browser)
```tsx
const pip = useCanvasPiP(canvasRef.current);
pip.enterPiP();
```
- Uses browser's built-in PiP
- Floating window stays on top
- Great for monitoring while in other apps

**4. MediaStream** (advanced)
```tsx
const stream = useCanvasStream(canvasRef.current);
const mediaStream = stream.startStream();
// Now you have a MediaStream you can pipe anywhere
```
- `canvas.captureStream(60)` is the magic
- Can be used as virtual camera (with extension)
- Can be sent over WebRTC
- Can be recorded with MediaRecorder

**The key insight:** The pop-out doesn't re-render the visualization — it just copies pixels from your main canvas every frame. Zero logic duplication.

For the Browser Source approach, you'd want your render loop to read from shared state (audio analyzer, mode params) that both the main page and `/output` route can access.

Want me to show how to wire the `/output` route into your existing Audio Canvas architecture?


---

/**
 * Canvas Output System
 * 
 * Provides multiple ways to expose the visualization canvas for external capture:
 * 
 * 1. Pop-out Window - Opens canvas in a clean window for OBS window capture
 * 2. Dedicated Route - /output page with just the canvas for OBS browser source
 * 3. Picture-in-Picture - Native browser PiP API
 * 4. Virtual Camera - Uses browser's MediaStream API (experimental)
 * 
 * The key insight: we DON'T duplicate the rendering.
 * Instead, we share the same canvas or stream its content.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

type OutputConfig = {
  width: number;
  height: number;
  frameRate: number;
  backgroundColor: string;
};

type OutputWindowState = {
  isOpen: boolean;
  window: Window | null;
  canvas: HTMLCanvasElement | null;
};

// ============================================================================
// Approach 1: Pop-out Window
// ============================================================================

/**
 * Opens a new window containing a canvas that mirrors the main visualization.
 * 
 * Two strategies:
 * A) Move the actual canvas element to the new window (complex, breaks React)
 * B) Create a secondary canvas and copy frames (simpler, slight overhead)
 * 
 * We'll use strategy B with requestAnimationFrame for smooth copying.
 */

export function usePopoutCanvas(sourceCanvas: HTMLCanvasElement | null) {
  const [state, setState] = useState<OutputWindowState>({
    isOpen: false,
    window: null,
    canvas: null,
  });
  
  const animationFrameRef = useRef<number | null>(null);

  const openPopout = useCallback((config: Partial<OutputConfig> = {}) => {
    if (!sourceCanvas) {
      console.warn("No source canvas provided");
      return;
    }

    const {
      width = sourceCanvas.width || 1920,
      height = sourceCanvas.height || 1080,
      backgroundColor = "#000000",
    } = config;

    // Open new window
    const features = [
      `width=${width}`,
      `height=${height}`,
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "resizable=yes",
    ].join(",");

    const popout = window.open("", "canvas-output", features);
    
    if (!popout) {
      console.error("Failed to open popout window. Check popup blocker.");
      return;
    }

    // Set up the popout document
    popout.document.title = "Audio Canvas Output";
    popout.document.body.style.cssText = `
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: ${backgroundColor};
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    `;

    // Create canvas in popout
    const outputCanvas = popout.document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    outputCanvas.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    `;
    popout.document.body.appendChild(outputCanvas);

    // Add minimal controls
    const controls = popout.document.createElement("div");
    controls.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 100;
    `;
    controls.innerHTML = `
      <button id="fullscreen-btn" style="
        padding: 8px 12px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        cursor: pointer;
      ">Fullscreen</button>
      <button id="resolution-btn" style="
        padding: 8px 12px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        cursor: pointer;
      ">${width}x${height}</button>
    `;
    popout.document.body.appendChild(controls);

    // Show controls on hover
    popout.document.body.addEventListener("mouseenter", () => {
      controls.style.opacity = "1";
    });
    popout.document.body.addEventListener("mouseleave", () => {
      controls.style.opacity = "0";
    });

    // Fullscreen button
    popout.document.getElementById("fullscreen-btn")?.addEventListener("click", () => {
      if (popout.document.fullscreenElement) {
        popout.document.exitFullscreen();
      } else {
        outputCanvas.requestFullscreen();
      }
    });

    setState({
      isOpen: true,
      window: popout,
      canvas: outputCanvas,
    });

    // Handle window close
    popout.addEventListener("beforeunload", () => {
      setState({ isOpen: false, window: null, canvas: null });
    });

    return outputCanvas;
  }, [sourceCanvas]);

  const closePopout = useCallback(() => {
    if (state.window && !state.window.closed) {
      state.window.close();
    }
    setState({ isOpen: false, window: null, canvas: null });
  }, [state.window]);

  // Frame copying loop
  useEffect(() => {
    if (!state.isOpen || !state.canvas || !sourceCanvas) {
      return;
    }

    const outputCtx = state.canvas.getContext("2d");
    if (!outputCtx) return;

    const copyFrame = () => {
      if (state.window?.closed) {
        setState({ isOpen: false, window: null, canvas: null });
        return;
      }

      // Draw source canvas to output canvas
      outputCtx.drawImage(
        sourceCanvas,
        0, 0,
        state.canvas!.width,
        state.canvas!.height
      );

      animationFrameRef.current = requestAnimationFrame(copyFrame);
    };

    copyFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isOpen, state.canvas, state.window, sourceCanvas]);

  return {
    isOpen: state.isOpen,
    openPopout,
    closePopout,
  };
}

// ============================================================================
// Approach 2: Canvas Stream (for virtual camera / recording)
// ============================================================================

/**
 * Creates a MediaStream from the canvas that can be:
 * - Used as a virtual camera source (with browser extension)
 * - Recorded directly
 * - Sent over WebRTC
 */

export function useCanvasStream(sourceCanvas: HTMLCanvasElement | null, frameRate = 60) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(() => {
    if (!sourceCanvas) {
      console.warn("No source canvas");
      return null;
    }

    // captureStream is the magic - creates a MediaStream from canvas
    const canvasStream = sourceCanvas.captureStream(frameRate);
    setStream(canvasStream);
    setIsStreaming(true);
    return canvasStream;
  }, [sourceCanvas, frameRate]);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsStreaming(false);
  }, [stream]);

  return {
    stream,
    isStreaming,
    startStream,
    stopStream,
  };
}

// ============================================================================
// Approach 3: Picture-in-Picture
// ============================================================================

/**
 * Uses the browser's native PiP API.
 * Requires converting canvas to video first.
 */

export function useCanvasPiP(sourceCanvas: HTMLCanvasElement | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const enterPiP = useCallback(async () => {
    if (!sourceCanvas) return;

    // Create hidden video element
    if (!videoRef.current) {
      const video = document.createElement("video");
      video.style.display = "none";
      video.muted = true;
      video.autoplay = true;
      document.body.appendChild(video);
      videoRef.current = video;
    }

    // Pipe canvas stream to video
    const stream = sourceCanvas.captureStream(60);
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    // Enter PiP
    try {
      await videoRef.current.requestPictureInPicture();
      setIsPiPActive(true);

      videoRef.current.addEventListener("leavepictureinpicture", () => {
        setIsPiPActive(false);
      }, { once: true });
    } catch (err) {
      console.error("PiP failed:", err);
    }
  }, [sourceCanvas]);

  const exitPiP = useCallback(async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
    setIsPiPActive(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.remove();
      }
    };
  }, []);

  return {
    isPiPActive,
    enterPiP,
    exitPiP,
    isSupported: "pictureInPictureEnabled" in document,
  };
}

// ============================================================================
// Output Panel Component (UI for all output options)
// ============================================================================

type OutputPanelProps = {
  sourceCanvas: HTMLCanvasElement | null;
  onClose?: () => void;
};

export function OutputPanel({ sourceCanvas, onClose }: OutputPanelProps) {
  const popout = usePopoutCanvas(sourceCanvas);
  const canvasStream = useCanvasStream(sourceCanvas);
  const pip = useCanvasPiP(sourceCanvas);
  
  const [selectedResolution, setSelectedResolution] = useState("1920x1080");
  const [copySuccess, setCopySuccess] = useState(false);

  const resolutions = [
    { label: "720p", width: 1280, height: 720 },
    { label: "1080p", width: 1920, height: 1080 },
    { label: "1440p", width: 2560, height: 1440 },
    { label: "4K", width: 3840, height: 2160 },
    { label: "Square 1080", width: 1080, height: 1080 },
    { label: "Portrait 1080", width: 1080, height: 1920 },
  ];

  const getOutputUrl = () => {
    // In a real app, this would be your deployed URL
    return `${window.location.origin}/output?resolution=${selectedResolution}`;
  };

  const copyOutputUrl = async () => {
    await navigator.clipboard.writeText(getOutputUrl());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="w-80 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Output / Capture</h3>
          <p className="text-[10px] text-white/50">For OBS, streaming, recording</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/60 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Resolution selector */}
        <div>
          <label className="text-[11px] text-white/60 block mb-2">Resolution</label>
          <div className="grid grid-cols-3 gap-1">
            {resolutions.map(res => (
              <button
                key={res.label}
                onClick={() => setSelectedResolution(`${res.width}x${res.height}`)}
                className={`px-2 py-1.5 rounded text-[10px] transition-colors ${
                  selectedResolution === `${res.width}x${res.height}`
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-white/5 text-white/60 border border-transparent hover:bg-white/10"
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pop-out Window */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[11px] font-medium text-white">Pop-out Window</div>
              <div className="text-[10px] text-white/50">OBS Window Capture</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
              popout.isOpen ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
            }`}>
              {popout.isOpen ? "LIVE" : "OFF"}
            </span>
          </div>
          <button
            onClick={() => {
              if (popout.isOpen) {
                popout.closePopout();
              } else {
                const [w, h] = selectedResolution.split("x").map(Number);
                popout.openPopout({ width: w, height: h });
              }
            }}
            className={`w-full py-2 rounded-lg text-[11px] font-medium transition-colors ${
              popout.isOpen
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
            }`}
          >
            {popout.isOpen ? "Close Window" : "Open Output Window"}
          </button>
          <p className="mt-2 text-[9px] text-white/40">
            In OBS: Add → Window Capture → Select "Audio Canvas Output"
          </p>
        </div>

        {/* Browser Source URL */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-[11px] font-medium text-white mb-1">Browser Source URL</div>
          <div className="text-[10px] text-white/50 mb-2">OBS Browser Source (cleanest)</div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={getOutputUrl()}
              className="flex-1 px-2 py-1.5 rounded bg-black/40 border border-white/10 text-[10px] text-white/70 font-mono truncate"
            />
            <button
              onClick={copyOutputUrl}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/70 border border-white/10 transition-colors"
            >
              {copySuccess ? "✓" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[9px] text-white/40">
            In OBS: Add → Browser → Paste URL → Set size to {selectedResolution}
          </p>
        </div>

        {/* Picture in Picture */}
        {pip.isSupported && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-[11px] font-medium text-white">Picture-in-Picture</div>
                <div className="text-[10px] text-white/50">Floating preview window</div>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                pip.isPiPActive ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
              }`}>
                {pip.isPiPActive ? "ACTIVE" : "OFF"}
              </span>
            </div>
            <button
              onClick={() => pip.isPiPActive ? pip.exitPiP() : pip.enterPiP()}
              className="w-full py-2 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
            >
              {pip.isPiPActive ? "Exit PiP" : "Enter PiP Mode"}
            </button>
          </div>
        )}

        {/* Canvas Stream (advanced) */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[11px] font-medium text-white">MediaStream</div>
              <div className="text-[10px] text-white/50">Virtual camera / WebRTC</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
              canvasStream.isStreaming ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
            }`}>
              {canvasStream.isStreaming ? "STREAMING" : "OFF"}
            </span>
          </div>
          <button
            onClick={() => canvasStream.isStreaming ? canvasStream.stopStream() : canvasStream.startStream()}
            className="w-full py-2 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
          >
            {canvasStream.isStreaming ? "Stop Stream" : "Start Stream"}
          </button>
          <p className="mt-2 text-[9px] text-white/40">
            Requires virtual camera extension to use as webcam input
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Dedicated Output Page Component (for /output route)
// ============================================================================

/**
 * This would be rendered at /output in your router.
 * It's a clean page with just the canvas - no UI.
 * 
 * URL params:
 * - resolution: "1920x1080"
 * - bg: background color (hex without #)
 */

type OutputPageProps = {
  // Your actual render function
  renderVisualization: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  // Or pass the shared state/audio data your visualizer needs
  audioData?: {
    bass: number;
    mid: number;
    high: number;
    waveform: Float32Array;
  };
  activeMode?: string;
};

export function OutputPage({ renderVisualization }: OutputPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resolution, setResolution] = useState({ width: 1920, height: 1080 });
  const [bgColor, setBgColor] = useState("#000000");

  // Parse URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const res = params.get("resolution");
    if (res) {
      const [w, h] = res.split("x").map(Number);
      if (w && h) setResolution({ width: w, height: h });
    }

    const bg = params.get("bg");
    if (bg) setBgColor(`#${bg}`);
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      renderVisualization(ctx, resolution.width, resolution.height);
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [renderVisualization, resolution]);

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={resolution.width}
        height={resolution.height}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

// ============================================================================
// Demo Component
// ============================================================================

export default function OutputDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPanel, setShowPanel] = useState(true);

  // Demo visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let animationId: number;

    const render = () => {
      time += 0.02;
      
      // Simple demo viz
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Animated circles
      for (let i = 0; i < 5; i++) {
        const x = canvas.width / 2 + Math.sin(time + i) * 200;
        const y = canvas.height / 2 + Math.cos(time * 0.7 + i) * 150;
        const r = 50 + Math.sin(time * 2 + i) * 30;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `hsla(${(time * 50 + i * 60) % 360}, 80%, 60%, 0.8)`);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f]">
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full object-contain"
      />

      {/* Output panel toggle */}
      <button
        onClick={() => setShowPanel(p => !p)}
        className="fixed top-4 right-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-[12px] text-white/70 transition-colors z-50"
      >
        {showPanel ? "Hide" : "Show"} Output Panel
      </button>

      {/* Output panel */}
      {showPanel && (
        <div className="fixed top-16 right-4 z-50">
          <OutputPanel
            sourceCanvas={canvasRef.current}
            onClose={() => setShowPanel(false)}
          />
        </div>
      )}
    </div>
  );
}


