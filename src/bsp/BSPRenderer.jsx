/**
 * BSP Renderer for Three.js / React Three Fiber
 * Converts parsed BSP data into renderable Three.js geometry
 *
 * Based on hlbsp-web and hlbsp rendering approaches
 */

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// GoldSrc uses a different coordinate system - swap Y and Z
function convertCoords(v) {
  return new THREE.Vector3(v.x, v.z, -v.y)
}

// Scale factor (GoldSrc units are ~1 inch, we want meters-ish)
const SCALE = 0.02

/**
 * Build Three.js geometry from BSP face data
 */
function buildFaceGeometry(bspData, faceIndices, textures, wadTextures) {
  const positions = []
  const normals = []
  const uvs = []
  const groups = []

  // Group faces by texture for efficient rendering
  const facesByTexture = new Map()

  for (const faceIdx of faceIndices) {
    const face = bspData.faces[faceIdx]
    const texinfo = bspData.texinfo[face.texinfo]
    const textureName = bspData.textures[texinfo.miptex]?.name || 'default'

    if (!facesByTexture.has(textureName)) {
      facesByTexture.set(textureName, [])
    }
    facesByTexture.get(textureName).push(faceIdx)
  }

  let vertexOffset = 0

  for (const [textureName, faces] of facesByTexture) {
    const groupStart = positions.length / 3

    for (const faceIdx of faces) {
      const face = bspData.faces[faceIdx]
      const plane = bspData.planes[face.planeNum]
      const texinfo = bspData.texinfo[face.texinfo]
      const texture = bspData.textures[texinfo.miptex]

      // Get face vertices
      const faceVerts = []
      for (let e = 0; e < face.numEdges; e++) {
        const surfEdge = bspData.surfedges[face.firstEdge + e]
        const edge = bspData.edges[Math.abs(surfEdge)]
        const vertIdx = surfEdge >= 0 ? edge.v[0] : edge.v[1]
        faceVerts.push(bspData.vertices[vertIdx])
      }

      if (faceVerts.length < 3) continue

      // Calculate normal
      let normal = { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z }
      if (face.side) {
        normal = { x: -normal.x, y: -normal.y, z: -normal.z }
      }
      const threeNormal = convertCoords(normal)

      // Triangulate the face (fan triangulation)
      for (let i = 1; i < faceVerts.length - 1; i++) {
        const v0 = convertCoords(faceVerts[0])
        const v1 = convertCoords(faceVerts[i])
        const v2 = convertCoords(faceVerts[i + 1])

        positions.push(v0.x * SCALE, v0.y * SCALE, v0.z * SCALE)
        positions.push(v1.x * SCALE, v1.y * SCALE, v1.z * SCALE)
        positions.push(v2.x * SCALE, v2.y * SCALE, v2.z * SCALE)

        normals.push(threeNormal.x, threeNormal.y, threeNormal.z)
        normals.push(threeNormal.x, threeNormal.y, threeNormal.z)
        normals.push(threeNormal.x, threeNormal.y, threeNormal.z)

        // Calculate UV coordinates
        const texWidth = texture?.width || 64
        const texHeight = texture?.height || 64

        for (const v of [faceVerts[0], faceVerts[i], faceVerts[i + 1]]) {
          const u = (texinfo.s.x * v.x + texinfo.s.y * v.y + texinfo.s.z * v.z + texinfo.s.offset) / texWidth
          const vCoord = (texinfo.t.x * v.x + texinfo.t.y * v.y + texinfo.t.z * v.z + texinfo.t.offset) / texHeight
          uvs.push(u, 1 - vCoord) // Flip V for WebGL
        }
      }
    }

    const groupCount = (positions.length / 3) - groupStart
    if (groupCount > 0) {
      groups.push({
        start: groupStart,
        count: groupCount,
        materialIndex: groups.length,
        textureName
      })
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  // Set up material groups
  groups.forEach((g, i) => {
    geometry.addGroup(g.start, g.count, i)
  })

  return { geometry, groups }
}

/**
 * Create a texture from BSP embedded data or WAD
 */
function createTexture(textureData, wadTextures) {
  if (!textureData) {
    return createPlaceholderTexture()
  }

  const { name, width, height, pixels } = textureData

  // Try to get from WAD if not embedded
  let pixelData = pixels
  if (!pixelData && wadTextures) {
    const wadTex = wadTextures.get(name.toUpperCase())
    if (wadTex) {
      pixelData = wadTex.pixels
    }
  }

  if (!pixelData) {
    return createPlaceholderTexture(name)
  }

  // For now, create a colored placeholder based on texture name
  // Full texture decoding would require the palette
  return createPlaceholderTexture(name)
}

function createPlaceholderTexture(name = 'default') {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  // Generate a color based on texture name hash
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash) % 360
  ctx.fillStyle = `hsl(${hue}, 40%, 30%)`
  ctx.fillRect(0, 0, 64, 64)

  // Add grid lines
  ctx.strokeStyle = `hsl(${hue}, 40%, 40%)`
  ctx.lineWidth = 1
  for (let i = 0; i <= 64; i += 16) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 64)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(64, i)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  return texture
}

/**
 * Fly Camera Controller
 */
function FlyCamera({ speed = 5, sensitivity = 0.002 }) {
  const { camera, gl } = useThree()
  const keys = useRef({})
  const isPointerLocked = useRef(false)
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    const handleKeyDown = (e) => { keys.current[e.code] = true }
    const handleKeyUp = (e) => { keys.current[e.code] = false }

    const handleMouseMove = (e) => {
      if (!isPointerLocked.current) return

      euler.current.y -= e.movementX * sensitivity
      euler.current.x -= e.movementY * sensitivity
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === gl.domElement
    }

    const handleClick = () => {
      if (!isPointerLocked.current) {
        gl.domElement.requestPointerLock()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    gl.domElement.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      gl.domElement.removeEventListener('click', handleClick)
    }
  }, [camera, gl, sensitivity])

  useFrame((_, delta) => {
    const direction = new THREE.Vector3()
    const right = new THREE.Vector3()

    camera.getWorldDirection(direction)
    right.crossVectors(direction, camera.up).normalize()

    const velocity = new THREE.Vector3()

    if (keys.current['KeyW']) velocity.add(direction)
    if (keys.current['KeyS']) velocity.sub(direction)
    if (keys.current['KeyA']) velocity.sub(right)
    if (keys.current['KeyD']) velocity.add(right)
    if (keys.current['Space']) velocity.y += 1
    if (keys.current['ShiftLeft']) velocity.y -= 1

    velocity.normalize().multiplyScalar(speed * delta)
    camera.position.add(velocity)
  })

  return null
}

/**
 * Main BSP Scene Component
 */
export default function BSPRenderer({ bspData, wadTextures, audioContext }) {
  const groupRef = useRef()
  const [meshData, setMeshData] = useState(null)

  // Build geometry when BSP data changes
  useEffect(() => {
    if (!bspData) return

    // Get all face indices from model 0 (the world)
    const worldModel = bspData.models[0]
    const faceIndices = []
    for (let i = 0; i < worldModel.numFaces; i++) {
      faceIndices.push(worldModel.firstFace + i)
    }

    const { geometry, groups } = buildFaceGeometry(bspData, faceIndices, bspData.textures, wadTextures)

    // Create materials for each texture group
    const materials = groups.map(g => {
      const texture = createTexture(
        bspData.textures.find(t => t?.name === g.textureName),
        wadTextures
      )

      return new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1
      })
    })

    setMeshData({ geometry, materials })

    return () => {
      geometry.dispose()
      materials.forEach(m => {
        m.map?.dispose()
        m.dispose()
      })
    }
  }, [bspData, wadTextures])

  // Get spawn point for camera
  const spawnPoint = useMemo(() => {
    if (!bspData) return new THREE.Vector3(0, 2, 0)

    const spawn = bspData.entities.find(e =>
      e.classname === 'info_player_start' ||
      e.classname === 'info_player_deathmatch'
    )

    if (spawn?.origin) {
      const parts = spawn.origin.split(' ').map(Number)
      const pos = convertCoords({ x: parts[0], y: parts[1], z: parts[2] })
      return pos.multiplyScalar(SCALE)
    }

    return new THREE.Vector3(0, 2, 0)
  }, [bspData])

  // Set initial camera position
  const { camera } = useThree()
  useEffect(() => {
    camera.position.copy(spawnPoint)
    camera.position.y += 1.5 // Eye height
  }, [camera, spawnPoint])

  if (!meshData) return null

  return (
    <group ref={groupRef}>
      <FlyCamera speed={10} />
      <mesh geometry={meshData.geometry} material={meshData.materials} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.6} />
    </group>
  )
}

export { FlyCamera, buildFaceGeometry, SCALE }
