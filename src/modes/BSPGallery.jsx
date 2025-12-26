/**
 * BSP Gallery Mode
 * Load GoldSrc BSP maps and explore them with a fly camera
 * Future: Replace wall textures with audio-reactive visualizations
 */

import { useState, useCallback, useRef } from 'react'
import { Html } from '@react-three/drei'
import BSPParser from '../bsp/parser'
import WADParser from '../bsp/wad'
import BSPRenderer from '../bsp/BSPRenderer'

export default function BSPGalleryMode({ audioContext, params }) {
  const [bspData, setBspData] = useState(null)
  const [wadTextures, setWadTextures] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mapName, setMapName] = useState(null)
  const fileInputRef = useRef()
  const wadInputRef = useRef()

  const handleBSPLoad = useCallback(async (file) => {
    setLoading(true)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const parser = new BSPParser()
      const data = await parser.parse(buffer)
      setBspData(data)
      setMapName(file.name.replace('.bsp', ''))

      console.log('BSP loaded:', {
        entities: data.entities.length,
        faces: data.faces.length,
        textures: data.textures.length,
        vertices: data.vertices.length
      })
    } catch (err) {
      console.error('BSP parse error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleWADLoad = useCallback(async (files) => {
    const allTextures = new Map()

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer()
        const parser = new WADParser()
        const textures = await parser.parse(buffer)

        for (const [name, tex] of textures) {
          allTextures.set(name, tex)
        }

        console.log(`WAD ${file.name} loaded: ${textures.size} textures`)
      } catch (err) {
        console.warn(`Failed to load WAD ${file.name}:`, err)
      }
    }

    setWadTextures(allTextures)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    const bspFile = files.find(f => f.name.toLowerCase().endsWith('.bsp'))
    const wadFiles = files.filter(f => f.name.toLowerCase().endsWith('.wad'))

    if (wadFiles.length > 0) {
      handleWADLoad(wadFiles)
    }

    if (bspFile) {
      handleBSPLoad(bspFile)
    }
  }, [handleBSPLoad, handleWADLoad])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  // Show loading UI if no map loaded
  if (!bspData) {
    return (
      <Html fullscreen>
        <div
          className="w-full h-full flex items-center justify-center bg-black/80"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="text-center p-8">
            <div className="w-64 h-64 border-2 border-dashed border-white/30 rounded-xl flex flex-col items-center justify-center mb-6 hover:border-violet-500/50 transition-colors">
              {loading ? (
                <div className="text-white/60">
                  <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mb-4 mx-auto" />
                  Loading BSP...
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-4">🗺️</div>
                  <div className="text-white/80 font-medium mb-2">Drop BSP file here</div>
                  <div className="text-white/40 text-sm">
                    Half-Life / CS 1.6 maps
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="text-red-400 text-sm mb-4 bg-red-500/10 px-4 py-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".bsp"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleBSPLoad(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg transition-colors"
              >
                Browse BSP
              </button>

              <input
                ref={wadInputRef}
                type="file"
                accept=".wad"
                multiple
                className="hidden"
                onChange={(e) => handleWADLoad(Array.from(e.target.files))}
              />
              <button
                onClick={() => wadInputRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors"
              >
                Load WADs
              </button>
            </div>

            <div className="mt-6 text-white/30 text-xs">
              {wadTextures ? (
                <span className="text-green-400/60">
                  {wadTextures.size} textures loaded from WAD
                </span>
              ) : (
                'Optional: Load WAD files for textures'
              )}
            </div>

            <div className="mt-8 text-white/20 text-xs max-w-sm mx-auto">
              Try de_dust2.bsp, cs_office.bsp, or any GoldSrc map.
              WAD files provide textures (halflife.wad, cstrike.wad)
            </div>
          </div>
        </div>
      </Html>
    )
  }

  return (
    <group>
      <BSPRenderer
        bspData={bspData}
        wadTextures={wadTextures}
        audioContext={audioContext}
      />

      {/* HUD overlay */}
      <Html
        position={[0, 0, 0]}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          pointerEvents: 'none'
        }}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white/80">
          <div className="text-sm font-medium">{mapName}</div>
          <div className="text-xs text-white/40">
            {bspData.faces.length} faces | Click to fly | ESC to unlock
          </div>
        </div>
      </Html>
    </group>
  )
}

// Mode definition for the mode registry
export const BSPGalleryModeDef = {
  id: 'bspGallery',
  name: 'BSP Gallery',
  description: 'Explore GoldSrc maps with a fly camera',
  component: BSPGalleryMode,
  params: {},
  category: 'experimental'
}
