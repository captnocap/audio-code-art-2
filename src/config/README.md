# Mode Navigation Configuration

This file (`src/config/modes.json`) controls which visualization modes appear in each navigation strip.

## Layout Structure

The UI has three edge strips where modes are displayed:

- **Top**: 2D & 3D Visual modes (blue)
- **Left**: Experimental modes (purple)
- **Right**: Games & Interactive modes (red)

## Editing the Config

To reorganize modes, simply edit the `modes` array in each section:

```json
{
  "layout": {
    "top": {
      "label": "2D & 3D Visuals",
      "color": "#3b82f6",
      "modes": [
        "neuralDreams",
        "psychedelic",
        "constellation"
      ]
    },
    "left": {
      "label": "Experimental",
      "color": "#a855f7",  
      "modes": [
        "aichat",
        "wrongapi"
      ]
    },
    "right": {
      "label": "Games & Interactive",
      "color": "#ef4444",
      "modes": [
        "wormhole",
        "tetris"
      ]
    }
  }
}
```

## Available Mode IDs

### 2D Modes
- `neuralDreams`, `psychedelic`, `constellation`, `mandelbrot`, `lsystem`, `plotter`, `spirograph`, `mandala`, `voronoi`, `reactiondiffusion`, `cymatics`, `stainedglass`, `crystal`, `flowParticles`, `contours`, `pixelSort`, `mirror`, `rings`, `orbitals`, `orbits`, `pipes`, `terrain`, `automata`, `mycelium`, `molecular`, `electrochemistry`, `polymer`, `combustion`, `beach`, `isometric`, `aichat`, `antiviz`, `audiogrid`, `audiosurf`, `edgegravity`, `feedback`, `jsxgen`, `titration`, `synesthesialies`, `wrongapi`, `quantum gravity`, `corruption`, `timedisplacement`

### 3D Modes
- `wormhole3d`, `wormhole3D`, `psychedelic3D`, `hallucination3D`, `nebula3D`, `topography3D`, `tunnel3D`, `dimensional3D`, `demolition3D`, `softbody3D`, `gravity3D`, `geometry3D`, `protein3D`, `beach3d3D`

### Game/Interactive Modes
- `wormhole`, `bullethell`, `tetris`, `minesweeper`, `audiosurf`

## Customization

You can:
- **Move modes** between sections by changing which array they're in
- **Change colors** by editing the hex color codes
- **Change labels** by editing the "label" field (though this won't display in current UI)
- **Reorder modes** by changing their position in the array (left to right on screen)

The changes will be picked up automatically when you save the file (hot module reload).
