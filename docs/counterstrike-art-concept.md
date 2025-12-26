repos:
https://github.com/MathiasVP/CS/tree/master
https://github.com/rein4ce/hlbsp
https://github.com/bernhardmgruber/hlbsp-web
https://github.com/VadimDez/Counter-Strike-JS

# BSP Gallery: Audio-Reactive Nostalgia Engine

## The Concept
Load any GoldSrc BSP map (CS 1.6, Half-Life, TFC, DoD, etc.) and replace wall textures with live audio-reactive visualizations. Fly through your childhood with breathing walls.

---

## How BSP Rendering Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     BSP FILE STRUCTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LUMPS (data chunks):                                           │
│  ├── Entities      → spawn points, lights, triggers             │
│  ├── Planes        → infinite planes for BSP tree               │
│  ├── Vertices      → 3D coordinates                             │
│  ├── Edges         → vertex pairs                               │
│  ├── Faces         → polygons (what we render)                  │
│  ├── Texinfo       → texture mapping per face                   │
│  ├── Textures      → embedded textures (some maps)              │
│  ├── Lightmaps     → baked lighting data                        │
│  └── VIS           → visibility optimization                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** Each FACE has a texture reference. That's our injection point.

---

## Current Texture Pipeline (hlbsp-web style)

```js
// 1. Parse BSP, extract face data
const faces = parseBSP(bspBuffer);

// 2. For each unique texture name, load from WAD or embedded
for (const texName of uniqueTextures) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Load from WAD file or embedded BSP textures
  const imageData = loadFromWAD(texName) || loadEmbedded(texName);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
  
  textureCache[texName] = texture;
}

// 3. Render loop - bind texture per face
function render() {
  for (const face of visibleFaces) {
    gl.bindTexture(gl.TEXTURE_2D, textureCache[face.textureName]);
    gl.drawArrays(gl.TRIANGLES, face.start, face.count);
  }
}
```

---

## Our Injection: Canvas Textures

WebGL can accept canvas elements directly as texture sources:

```js
// Create offscreen canvas for each viz mode
const vizCanvas = document.createElement('canvas');
vizCanvas.width = 512;  // Power of 2 for mipmaps
vizCanvas.height = 512;
const vizCtx = vizCanvas.getContext('2d');

// Create WebGL texture
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vizCanvas);

// EVERY FRAME - update texture from canvas
function updateTexture() {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vizCanvas);
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BSP GALLERY                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   BSP        │    │   Audio      │    │   Viz Mode   │       │
│  │   Parser     │    │   Analyzer   │    │   Library    │       │
│  │              │    │              │    │              │       │
│  │  hlbsp-web   │    │  Your        │    │  Your        │       │
│  │  or          │    │  existing    │    │  existing    │       │
│  │  MathiasVP   │    │  analyzer    │    │  30+ modes   │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  TEXTURE MANAGER                      │       │
│  │                                                       │       │
│  │  textureMap = {                                       │       │
│  │    'WALL_BRICK':  { canvas, ctx, vizMode: 'flow' },  │       │
│  │    'FLOOR_TILE':  { canvas, ctx, vizMode: 'voronoi'},│       │
│  │    'CEILING':     { canvas, ctx, vizMode: 'mandala'},│       │
│  │    ...                                                │       │
│  │  }                                                    │       │
│  │                                                       │       │
│  │  Per frame:                                           │       │
│  │  1. Get audio features                                │       │
│  │  2. Update each canvas with its viz mode              │       │
│  │  3. Push all canvases to WebGL textures               │       │
│  │                                                       │       │
│  └──────────────────────────────────────────────────────┘       │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                   WebGL RENDERER                      │       │
│  │                                                       │       │
│  │  - Camera controls (fly-through, noclip)              │       │
│  │  - BSP tree traversal for visibility                  │       │
│  │  - Face rendering with dynamic textures               │       │
│  │  - Optional: lightmap blending                        │       │
│  │                                                       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Texture Assignment Strategies

### 1. By Original Texture Name (Semantic)
```js
const textureRules = {
  // Walls get different treatments
  'WALL*':     'flow',
  'BRICK*':    'voronoi', 
  'METAL*':    'rings',
  
  // Floors/ceilings
  'FLOOR*':    'mandala',
  'CEIL*':     'stars',
  
  // Special surfaces
  'SKY*':      'nebula',    // 3D mode for skybox
  'WATER*':    'reaction',  // Reaction-diffusion
  
  // Fallback
  '*':         'flow'
};
```

### 2. By Face Normal (Directional)
```js
function getModeByNormal(normal) {
  if (Math.abs(normal.y) > 0.9) {
    // Floor or ceiling
    return normal.y > 0 ? 'mandala' : 'stars';
  }
  // Walls - assign by angle
  const angle = Math.atan2(normal.z, normal.x);
  return WALL_MODES[Math.floor(angle / (Math.PI / 4)) % WALL_MODES.length];
}
```

### 3. By Location (Spatial Zones)
```js
// Define zones based on BSP entities
const zones = parseEntities(bsp).filter(e => e.classname === 'info_player_*');

function getModeByPosition(faceCenter) {
  // Distance from spawn points affects mode
  const nearestZone = findNearest(faceCenter, zones);
  return ZONE_MODES[nearestZone.team]; // CT spawn vs T spawn different vibes
}
```

### 4. Distance Attenuation
```js
// Closer walls = more intense audio reactivity
function getAudioInfluence(faceCenter, cameraPos) {
  const dist = distance(faceCenter, cameraPos);
  return Math.max(0, 1 - dist / MAX_DISTANCE);
}

// Feed attenuated audio to each face's viz mode
face.vizMode.update(audioFeatures.map(f => f * face.audioInfluence));
```

---

## Performance Considerations

### Problem: Updating 100+ textures per frame is expensive

### Solutions:

**1. Resolution Tiers**
```js
// Nearby faces: 512x512
// Medium distance: 256x256  
// Far faces: 128x128 or skip updates entirely
function getTextureResolution(distance) {
  if (distance < 500) return 512;
  if (distance < 1500) return 256;
  return 128;
}
```

**2. Update Throttling**
```js
// Not all textures need 60fps updates
// Stagger updates across frames
let updateIndex = 0;
function updateTextures() {
  const batchSize = Math.ceil(textures.length / 4);
  const start = (updateIndex * batchSize) % textures.length;
  const end = Math.min(start + batchSize, textures.length);
  
  for (let i = start; i < end; i++) {
    textures[i].update(audioFeatures);
  }
  updateIndex++;
}
```

**3. Texture Atlasing**
```js
// Combine multiple small viz outputs into one large texture
// Reduces texture bind calls dramatically
const atlas = new TextureAtlas(2048, 2048);
atlas.addRegion('wall1', flowCanvas, 0, 0, 256, 256);
atlas.addRegion('wall2', voronoiCanvas, 256, 0, 256, 256);
// Adjust UV coords in shader to sample correct region
```

**4. SharedArrayBuffer for Workers**
```js
// Run viz modes in Web Workers
// Share audio data via SharedArrayBuffer
const audioBuffer = new SharedArrayBuffer(1024 * 4);
const audioView = new Float32Array(audioBuffer);

// Worker updates canvas, main thread just uploads to GPU
```

---

## Integration with Your Existing Code

Your viz modes already follow this pattern:
```js
class VizMode {
  constructor(ctx, width, height) { ... }
  update(audioFeatures, beatInfo) { ... }
  draw() { ... }
}
```

Minimal wrapper needed:
```js
class TexturedVizMode {
  constructor(ModeClass, width = 512, height = 512) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.mode = new ModeClass(this.ctx, width, height);
    this.mode.init();
  }
  
  update(audioFeatures, beatInfo) {
    this.mode.update(audioFeatures, beatInfo);
    this.mode.draw();
    return this.canvas; // Ready for gl.texImage2D
  }
}
```

---

## File Structure

```
bsp-gallery/
├── src/
│   ├── bsp/
│   │   ├── parser.js       # BSP v30 parser (from hlbsp-web)
│   │   ├── wad.js          # WAD texture loader (optional, for mixing)
│   │   └── entities.js     # Entity parser for spawn points etc
│   │
│   ├── render/
│   │   ├── renderer.js     # WebGL setup + render loop
│   │   ├── camera.js       # Fly-through controls
│   │   ├── textures.js     # Dynamic texture manager
│   │   └── shaders/
│   │       ├── world.vert
│   │       └── world.frag
│   │
│   ├── audio/
│   │   └── [YOUR EXISTING AUDIO CODE]
│   │
│   ├── visual/
│   │   └── [YOUR EXISTING VIZ MODES]
│   │
│   └── main.js
│
├── index.html
└── README.md
```

---

## MVP Milestones

### v0.1 - Proof of Concept
- [ ] Load single BSP (de_dust2)
- [ ] Replace ALL textures with single viz mode (flow)
- [ ] Basic fly camera
- [ ] Audio input working

### v0.2 - Multi-Mode
- [ ] Different viz modes per texture group
- [ ] Texture name → mode mapping
- [ ] Performance baseline

### v0.3 - Polish
- [ ] Distance-based resolution scaling
- [ ] Lightmap blending option
- [ ] UI for mode assignment
- [ ] Export screenshots

### v0.4 - Platform
- [ ] Drag-drop any BSP
- [ ] WAD file support for original textures (hybrid mode)
- [ ] Save/load configurations
- [ ] Shareable links

---

## Sources

- **MathiasVP/CS** - Original CS 1.6 JS implementation, MDL + BSP parsing
- **bernhardmgruber/hlbsp-web** - Clean BSP v30 parser with WebGL
- **rein4ce/hlbsp** - Half-Life WebGL viewer
- **Valve Developer Wiki** - BSP file format specification
- **WebGL Fundamentals** - Texture and canvas integration patterns

---

## The Vision

> You load up fy_iceworld.bsp
> Drop in a synthwave track
> The minimal geometry becomes a breathing crystal palace
> You're 14 again but the walls are alive
> 
> Then you load de_rats
> Play some drum & bass
> You're an ant in a giant kitchen where every surface pulses with bass
>
> 20 years of community maps
> Transformed into synesthetic galleries
> Nostalgia as a medium
