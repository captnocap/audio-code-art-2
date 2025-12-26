#!/usr/bin/env node
/**
 * BSP to JSON Converter
 *
 * Converts GoldSrc BSP v30 files to JSON for fast browser loading
 *
 * Usage: node bsp-to-json.cjs <input.bsp> [output.json]
 */

const fs = require('fs')
const path = require('path')

// Lump indices for BSP v30
const LUMP = {
  ENTITIES: 0,
  PLANES: 1,
  TEXTURES: 2,
  VERTICES: 3,
  VISIBILITY: 4,
  NODES: 5,
  TEXINFO: 6,
  FACES: 7,
  LIGHTING: 8,
  CLIPNODES: 9,
  LEAVES: 10,
  MARKSURFACES: 11,
  EDGES: 12,
  SURFEDGES: 13,
  MODELS: 14,
  HEADER_LUMPS: 15
}

class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer
    this.offset = 0
  }

  seek(offset) {
    this.offset = offset
  }

  readInt8() {
    const val = this.buffer.readInt8(this.offset)
    this.offset += 1
    return val
  }

  readUint8() {
    const val = this.buffer.readUInt8(this.offset)
    this.offset += 1
    return val
  }

  readInt16() {
    const val = this.buffer.readInt16LE(this.offset)
    this.offset += 2
    return val
  }

  readUint16() {
    const val = this.buffer.readUInt16LE(this.offset)
    this.offset += 2
    return val
  }

  readInt32() {
    const val = this.buffer.readInt32LE(this.offset)
    this.offset += 4
    return val
  }

  readUint32() {
    const val = this.buffer.readUInt32LE(this.offset)
    this.offset += 4
    return val
  }

  readFloat32() {
    const val = this.buffer.readFloatLE(this.offset)
    this.offset += 4
    return val
  }

  readVec3() {
    return [
      this.readFloat32(),
      this.readFloat32(),
      this.readFloat32()
    ]
  }

  readString(length) {
    const bytes = this.buffer.slice(this.offset, this.offset + length)
    this.offset += length
    const nullIndex = bytes.indexOf(0)
    return bytes.slice(0, nullIndex === -1 ? length : nullIndex).toString('utf8')
  }

  readBytes(length) {
    const bytes = this.buffer.slice(this.offset, this.offset + length)
    this.offset += length
    return bytes
  }
}

function parseBSP(buffer) {
  const reader = new BinaryReader(buffer)
  const result = {}

  // Read header
  const version = reader.readInt32()
  if (version !== 30) {
    throw new Error(`Unsupported BSP version: ${version}. Expected v30 (GoldSrc)`)
  }
  result.version = version

  // Read lump directory
  const lumps = []
  for (let i = 0; i < LUMP.HEADER_LUMPS; i++) {
    lumps.push({
      offset: reader.readInt32(),
      length: reader.readInt32()
    })
  }

  // Parse entities
  const entLump = lumps[LUMP.ENTITIES]
  reader.seek(entLump.offset)
  const entityString = reader.readString(entLump.length)
  result.entities = parseEntityString(entityString)

  // Parse planes
  const planeLump = lumps[LUMP.PLANES]
  reader.seek(planeLump.offset)
  const planeCount = planeLump.length / 20
  result.planes = []
  for (let i = 0; i < planeCount; i++) {
    result.planes.push({
      normal: reader.readVec3(),
      dist: reader.readFloat32(),
      type: reader.readInt32()
    })
  }

  // Parse textures
  const texLump = lumps[LUMP.TEXTURES]
  result.textures = []
  if (texLump.length > 0) {
    reader.seek(texLump.offset)
    const numTextures = reader.readInt32()
    const offsets = []
    for (let i = 0; i < numTextures; i++) {
      offsets.push(reader.readInt32())
    }
    for (let i = 0; i < numTextures; i++) {
      if (offsets[i] === -1) {
        result.textures.push(null)
        continue
      }
      reader.seek(texLump.offset + offsets[i])
      const name = reader.readString(16)
      const width = reader.readUint32()
      const height = reader.readUint32()
      // Skip mipmap offsets for now
      result.textures.push({ name, width, height })
    }
  }

  // Parse vertices
  const vertLump = lumps[LUMP.VERTICES]
  reader.seek(vertLump.offset)
  const vertCount = vertLump.length / 12
  result.vertices = []
  for (let i = 0; i < vertCount; i++) {
    result.vertices.push(reader.readVec3())
  }

  // Parse texinfo
  const texinfoLump = lumps[LUMP.TEXINFO]
  reader.seek(texinfoLump.offset)
  const texinfoCount = texinfoLump.length / 40
  result.texinfo = []
  for (let i = 0; i < texinfoCount; i++) {
    result.texinfo.push({
      s: { v: reader.readVec3(), offset: reader.readFloat32() },
      t: { v: reader.readVec3(), offset: reader.readFloat32() },
      miptex: reader.readUint32(),
      flags: reader.readUint32()
    })
  }

  // Parse faces
  const faceLump = lumps[LUMP.FACES]
  reader.seek(faceLump.offset)
  const faceCount = faceLump.length / 20
  result.faces = []
  for (let i = 0; i < faceCount; i++) {
    result.faces.push({
      planeNum: reader.readUint16(),
      side: reader.readUint16(),
      firstEdge: reader.readInt32(),
      numEdges: reader.readInt16(),
      texinfo: reader.readInt16(),
      styles: [reader.readUint8(), reader.readUint8(), reader.readUint8(), reader.readUint8()],
      lightOffset: reader.readInt32()
    })
  }

  // Parse edges
  const edgeLump = lumps[LUMP.EDGES]
  reader.seek(edgeLump.offset)
  const edgeCount = edgeLump.length / 4
  result.edges = []
  for (let i = 0; i < edgeCount; i++) {
    result.edges.push([reader.readUint16(), reader.readUint16()])
  }

  // Parse surfedges
  const surfedgeLump = lumps[LUMP.SURFEDGES]
  reader.seek(surfedgeLump.offset)
  const surfedgeCount = surfedgeLump.length / 4
  result.surfedges = []
  for (let i = 0; i < surfedgeCount; i++) {
    result.surfedges.push(reader.readInt32())
  }

  // Parse models
  const modelLump = lumps[LUMP.MODELS]
  reader.seek(modelLump.offset)
  const modelCount = modelLump.length / 64
  result.models = []
  for (let i = 0; i < modelCount; i++) {
    result.models.push({
      mins: reader.readVec3(),
      maxs: reader.readVec3(),
      origin: reader.readVec3(),
      headNodes: [reader.readInt32(), reader.readInt32(), reader.readInt32(), reader.readInt32()],
      visLeafs: reader.readInt32(),
      firstFace: reader.readInt32(),
      numFaces: reader.readInt32()
    })
  }

  return result
}

function parseEntityString(str) {
  const entities = []
  const regex = /\{([^}]*)\}/g
  let match

  while ((match = regex.exec(str)) !== null) {
    const entity = {}
    const content = match[1]
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const kvMatch = trimmed.match(/"([^"]+)"\s+"([^"]*)"/)
      if (kvMatch) {
        entity[kvMatch[1]] = kvMatch[2]
      }
    }

    if (Object.keys(entity).length > 0) {
      entities.push(entity)
    }
  }

  return entities
}

// Pre-compute triangulated geometry for fast loading
function precomputeGeometry(bsp) {
  const worldModel = bsp.models[0]
  const geometry = {
    positions: [],
    normals: [],
    uvs: [],
    faceGroups: {} // Grouped by texture name
  }

  for (let f = 0; f < worldModel.numFaces; f++) {
    const faceIdx = worldModel.firstFace + f
    const face = bsp.faces[faceIdx]
    const plane = bsp.planes[face.planeNum]
    const texinfo = bsp.texinfo[face.texinfo]
    const texture = bsp.textures[texinfo.miptex]
    const texName = texture?.name || 'default'

    if (!geometry.faceGroups[texName]) {
      geometry.faceGroups[texName] = { start: 0, count: 0 }
    }

    // Get face vertices
    const faceVerts = []
    for (let e = 0; e < face.numEdges; e++) {
      const surfEdge = bsp.surfedges[face.firstEdge + e]
      const edge = bsp.edges[Math.abs(surfEdge)]
      const vertIdx = surfEdge >= 0 ? edge[0] : edge[1]
      faceVerts.push(bsp.vertices[vertIdx])
    }

    if (faceVerts.length < 3) continue

    // Calculate normal
    let normal = plane.normal.slice()
    if (face.side) {
      normal = normal.map(n => -n)
    }

    // Triangulate (fan)
    const texWidth = texture?.width || 64
    const texHeight = texture?.height || 64

    for (let i = 1; i < faceVerts.length - 1; i++) {
      const verts = [faceVerts[0], faceVerts[i], faceVerts[i + 1]]

      for (const v of verts) {
        // Convert coords (swap Y/Z for Three.js)
        geometry.positions.push(v[0], v[2], -v[1])
        geometry.normals.push(normal[0], normal[2], -normal[1])

        // Calculate UVs
        const u = (texinfo.s.v[0] * v[0] + texinfo.s.v[1] * v[1] + texinfo.s.v[2] * v[2] + texinfo.s.offset) / texWidth
        const vCoord = (texinfo.t.v[0] * v[0] + texinfo.t.v[1] * v[1] + texinfo.t.v[2] * v[2] + texinfo.t.offset) / texHeight
        geometry.uvs.push(u, 1 - vCoord)
      }

      geometry.faceGroups[texName].count += 3
    }
  }

  // Calculate group starts
  let offset = 0
  for (const texName of Object.keys(geometry.faceGroups)) {
    geometry.faceGroups[texName].start = offset
    offset += geometry.faceGroups[texName].count
  }

  return geometry
}

// Main
const args = process.argv.slice(2)
if (args.length < 1) {
  console.log('Usage: node bsp-to-json.cjs <input.bsp> [output.json]')
  console.log('')
  console.log('Converts GoldSrc BSP v30 files to JSON for fast browser loading.')
  console.log('Output includes pre-triangulated geometry ready for WebGL.')
  process.exit(1)
}

const inputPath = args[0]
const outputPath = args[1] || inputPath.replace(/\.bsp$/i, '.json')

console.log(`Reading: ${inputPath}`)
const buffer = fs.readFileSync(inputPath)

console.log('Parsing BSP...')
const bsp = parseBSP(buffer)

console.log('Pre-computing geometry...')
const geometry = precomputeGeometry(bsp)

const output = {
  meta: {
    source: path.basename(inputPath),
    version: bsp.version,
    convertedAt: new Date().toISOString(),
    stats: {
      faces: bsp.faces.length,
      vertices: bsp.vertices.length,
      textures: bsp.textures.filter(Boolean).length,
      entities: bsp.entities.length,
      triangles: geometry.positions.length / 9
    }
  },
  entities: bsp.entities,
  textures: bsp.textures.filter(Boolean).map(t => ({ name: t.name, width: t.width, height: t.height })),
  geometry: {
    positions: geometry.positions,
    normals: geometry.normals,
    uvs: geometry.uvs,
    groups: geometry.faceGroups
  }
}

console.log(`Writing: ${outputPath}`)
fs.writeFileSync(outputPath, JSON.stringify(output))

const inputSize = buffer.length
const outputSize = fs.statSync(outputPath).size

console.log('')
console.log('Done!')
console.log(`  Input:  ${(inputSize / 1024 / 1024).toFixed(2)} MB`)
console.log(`  Output: ${(outputSize / 1024 / 1024).toFixed(2)} MB`)
console.log(`  Faces:  ${output.meta.stats.faces}`)
console.log(`  Tris:   ${output.meta.stats.triangles}`)
console.log(`  Textures: ${output.meta.stats.textures}`)
console.log('')
console.log('Tip: gzip the JSON for even smaller files!')
