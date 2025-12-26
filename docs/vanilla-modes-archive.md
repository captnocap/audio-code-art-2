# Vanilla JS Modes Archive

Reference list of all vanilla JS modes from the original audio-canvas repo. These files were removed from audiocanvaspro as they're incompatible with the React Three Fiber architecture.

Original files available in: `/home/siah/creative/audio-canvas/`

---

## Modes WITH JSX Recreation

These modes have been ported to the new r3f architecture:

| Vanilla JS | JSX Port | Notes |
|------------|----------|-------|
| `audiosurf.js` | `Audiosurf.jsx` | Highway runner with orb collection |
| `beach.js` | `Beach.jsx` | Ocean tides with sand memory |
| `cymatics.js` | `Cymatics.jsx` | Chladni plate standing waves |
| `flowParticles.js` | `FlowParticles.jsx` | Flow field with stipple accumulation |
| `hallucination3D.js` | `NeuralDreams.jsx` | NCA + warp streaks (renamed) |
| `mandala.js` | `Mandala.jsx` | Radial slice timeline |
| `mirror.js` | `Mirror.jsx` | Kaleidoscope symmetry |
| `pixelSort.js` | `PixelSort.jsx` | Glitch smears on amplitude |
| `psychedelic3D.js` | `Psychedelic.jsx` | Vertex twist + noise |
| `rings.js` | `Rings.jsx` | Concentric beat pulses |
| `spirograph.js` | `Spirograph.jsx` | Audio-modulated curves |
| `voronoi.js` | `Voronoi.jsx` | Cellular fracture on beats |
| `wormhole3D.js` | `Wormhole.jsx` | Tunnel with ring patterns |
| `WormholeMode.js` | `WormholeNative.jsx` | Tunnel with surfer player |

---

## Modes WITHOUT JSX Recreation (Future Candidates)

These modes exist only in vanilla JS and could be ported later:

### High Priority (Visually Impressive)
| Mode | Description |
|------|-------------|
| `nebula3D.js` | Space nebula with particle clouds |
| `gravity3D.js` | N-body gravitational simulation |
| `quantumgravity.js` | Quantum field visualization |
| `dimensional3D.js` | Dimensional shifting effects |
| `reactiondiffusion.js` | Turing patterns |
| `mycelium.js` | Fungal network growth |
| `lsystem.js` | L-system fractal trees |
| `constellation.js` | Star field connections |

### Games / Interactive
| Mode | Description |
|------|-------------|
| `tetris.js` | Audio-reactive Tetris |
| `minesweeper.js` | Audio-reactive Minesweeper |
| `bullethell.js` | Bullet hell shooter |

### Scientific / Technical
| Mode | Description |
|------|-------------|
| `molecular.js` | Molecular visualization |
| `protein3D.js` | Protein folding |
| `electrochemistry.js` | Chemical reactions |
| `titration.js` | pH titration curves |
| `polymer.js` | Polymer chain dynamics |
| `orbitals.js` | Atomic orbitals |

### Abstract / Artistic
| Mode | Description |
|------|-------------|
| `contours.js` | Topographic contour lines |
| `topography3D.js` | 3D terrain from audio |
| `terrain.js` | Procedural terrain |
| `stainedglass.js` | Stained glass patterns |
| `corruption.js` | Data corruption effects |
| `timedisplacement.js` | Temporal displacement |
| `pipes.js` | 3D pipe screensaver style |
| `tunnel3D.js` | Abstract tunnel |
| `isometric.js` | Isometric grid |
| `plotter.js` | Pen plotter style |

### Experimental / Broken
| Mode | Description |
|------|-------------|
| `aichat.js` | AI chat integration (API dependent) |
| `wrongapi.js` | Intentionally broken |
| `antiviz.js` | Anti-visualization |
| `synesthesialies.js` | Synesthesia experiment |
| `softbody3D.js` | Soft body physics (needs cannon-es) |
| `demolition3D.js` | Physics destruction (needs oimo) |

### Base Classes / Utilities
| File | Description |
|------|-------------|
| `VanillaBase.js` | Base class for 2D modes |
| `Vanilla3DBase.js` | Base class for 3D modes |
| `jsxgen.js` | JSX code generator |
| `uikit.js` | UI components |

---

## Removed Files (62 total)

```
aichat.js
antiviz.js
audiogrid.js
audiosurf.js
automata.js
beach.js
beach3d3D.js
bullethell.js
combustion.js
constellation.js
Constellation.js
contours.js
corruption.js
crystal.js
cymatics.js
demolition3D.js
dimensional3D.js
edgegravity.js
electrochemistry.js
feedback.js
flowParticles.js
geometry3D.js
gravity3D.js
hallucination3D.js
isometric.js
jsxgen.js
lsystem.js
mandala.js
mandelbrot.js
minesweeper.js
mirror.js
molecular.js
mycelium.js
nebula3D.js
orbitals.js
orbits.js
pipes.js
pixelSort.js
plotter.js
polymer.js
protein3D.js
psychedelic3D.js
quantumgravity.js
reactiondiffusion.js
rings.js
softbody3D.js
spirograph.js
stainedglass.js
synesthesialies.js
terrain.js
tetris.js
timedisplacement.js
titration.js
topography3D.js
tunnel3D.js
uikit.js
Vanilla3DBase.js
VanillaBase.js
voronoi.js
wormhole3D.js
WormholeMode.js
wrongapi.js
```

---

*Archived: 2024-12-25*
