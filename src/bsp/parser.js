/**
 * GoldSrc BSP v30 Parser
 * Parses Half-Life 1 / Counter-Strike 1.6 map files
 *
 * Based on hlbsp-web by Bernhard Gruber and hlbsp by Michael Domanski
 * BSP Format Reference: https://developer.valvesoftware.com/wiki/BSP_(GoldSrc)
 */

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

// Plane types
const PLANE_X = 0
const PLANE_Y = 1
const PLANE_Z = 2
const PLANE_ANYX = 3
const PLANE_ANYY = 4
const PLANE_ANYZ = 5

class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.offset = 0
  }

  seek(offset) {
    this.offset = offset
  }

  readInt8() {
    const val = this.view.getInt8(this.offset)
    this.offset += 1
    return val
  }

  readUint8() {
    const val = this.view.getUint8(this.offset)
    this.offset += 1
    return val
  }

  readInt16() {
    const val = this.view.getInt16(this.offset, true)
    this.offset += 2
    return val
  }

  readUint16() {
    const val = this.view.getUint16(this.offset, true)
    this.offset += 2
    return val
  }

  readInt32() {
    const val = this.view.getInt32(this.offset, true)
    this.offset += 4
    return val
  }

  readUint32() {
    const val = this.view.getUint32(this.offset, true)
    this.offset += 4
    return val
  }

  readFloat32() {
    const val = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return val
  }

  readVec3() {
    return {
      x: this.readFloat32(),
      y: this.readFloat32(),
      z: this.readFloat32()
    }
  }

  readString(length) {
    const bytes = new Uint8Array(this.buffer, this.offset, length)
    this.offset += length
    // Find null terminator
    let end = bytes.indexOf(0)
    if (end === -1) end = length
    return new TextDecoder('utf-8').decode(bytes.slice(0, end))
  }

  readBytes(length) {
    const bytes = new Uint8Array(this.buffer, this.offset, length)
    this.offset += length
    return bytes
  }
}

export class BSPParser {
  constructor() {
    this.reset()
  }

  reset() {
    this.version = 0
    this.lumps = []
    this.entities = []
    this.planes = []
    this.textures = []
    this.vertices = []
    this.visibility = null
    this.nodes = []
    this.texinfo = []
    this.faces = []
    this.lighting = null
    this.clipnodes = []
    this.leaves = []
    this.marksurfaces = []
    this.edges = []
    this.surfedges = []
    this.models = []
  }

  async parse(arrayBuffer) {
    this.reset()
    const reader = new BinaryReader(arrayBuffer)

    // Read header
    this.version = reader.readInt32()
    if (this.version !== 30) {
      throw new Error(`Unsupported BSP version: ${this.version}. Expected v30 (GoldSrc)`)
    }

    // Read lump directory (15 lumps)
    this.lumps = []
    for (let i = 0; i < LUMP.HEADER_LUMPS; i++) {
      this.lumps.push({
        offset: reader.readInt32(),
        length: reader.readInt32()
      })
    }

    // Parse each lump
    this.parseEntities(reader)
    this.parsePlanes(reader)
    this.parseTextures(reader)
    this.parseVertices(reader)
    this.parseVisibility(reader)
    this.parseNodes(reader)
    this.parseTexinfo(reader)
    this.parseFaces(reader)
    this.parseLighting(reader)
    this.parseClipnodes(reader)
    this.parseLeaves(reader)
    this.parseMarksurfaces(reader)
    this.parseEdges(reader)
    this.parseSurfedges(reader)
    this.parseModels(reader)

    return this.getData()
  }

  parseEntities(reader) {
    const lump = this.lumps[LUMP.ENTITIES]
    reader.seek(lump.offset)
    const entityString = reader.readString(lump.length)
    this.entities = this.parseEntityString(entityString)
  }

  parseEntityString(str) {
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

        // Parse "key" "value" pairs
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

  parsePlanes(reader) {
    const lump = this.lumps[LUMP.PLANES]
    reader.seek(lump.offset)
    const count = lump.length / 20 // sizeof(dplane_t) = 20

    for (let i = 0; i < count; i++) {
      this.planes.push({
        normal: reader.readVec3(),
        dist: reader.readFloat32(),
        type: reader.readInt32()
      })
    }
  }

  parseTextures(reader) {
    const lump = this.lumps[LUMP.TEXTURES]
    if (lump.length === 0) return

    reader.seek(lump.offset)
    const numTextures = reader.readInt32()

    // Read texture offsets
    const offsets = []
    for (let i = 0; i < numTextures; i++) {
      offsets.push(reader.readInt32())
    }

    // Read each texture
    for (let i = 0; i < numTextures; i++) {
      if (offsets[i] === -1) {
        this.textures.push(null)
        continue
      }

      reader.seek(lump.offset + offsets[i])

      const name = reader.readString(16)
      const width = reader.readUint32()
      const height = reader.readUint32()

      // Mipmap offsets (4 levels)
      const mipOffsets = [
        reader.readUint32(),
        reader.readUint32(),
        reader.readUint32(),
        reader.readUint32()
      ]

      // Read mip0 data if embedded
      let pixels = null
      if (mipOffsets[0] !== 0) {
        reader.seek(lump.offset + offsets[i] + mipOffsets[0])
        pixels = reader.readBytes(width * height)
      }

      this.textures.push({
        name,
        width,
        height,
        mipOffsets,
        pixels
      })
    }
  }

  parseVertices(reader) {
    const lump = this.lumps[LUMP.VERTICES]
    reader.seek(lump.offset)
    const count = lump.length / 12 // sizeof(vec3) = 12

    for (let i = 0; i < count; i++) {
      this.vertices.push(reader.readVec3())
    }
  }

  parseVisibility(reader) {
    const lump = this.lumps[LUMP.VISIBILITY]
    if (lump.length > 0) {
      reader.seek(lump.offset)
      this.visibility = reader.readBytes(lump.length)
    }
  }

  parseNodes(reader) {
    const lump = this.lumps[LUMP.NODES]
    reader.seek(lump.offset)
    const count = lump.length / 24 // sizeof(dnode_t) = 24

    for (let i = 0; i < count; i++) {
      this.nodes.push({
        planeNum: reader.readUint32(),
        children: [reader.readInt16(), reader.readInt16()],
        mins: [reader.readInt16(), reader.readInt16(), reader.readInt16()],
        maxs: [reader.readInt16(), reader.readInt16(), reader.readInt16()],
        firstFace: reader.readUint16(),
        numFaces: reader.readUint16()
      })
    }
  }

  parseTexinfo(reader) {
    const lump = this.lumps[LUMP.TEXINFO]
    reader.seek(lump.offset)
    const count = lump.length / 40 // sizeof(texinfo_t) = 40

    for (let i = 0; i < count; i++) {
      this.texinfo.push({
        // S vector (texture coordinate generation)
        s: {
          x: reader.readFloat32(),
          y: reader.readFloat32(),
          z: reader.readFloat32(),
          offset: reader.readFloat32()
        },
        // T vector
        t: {
          x: reader.readFloat32(),
          y: reader.readFloat32(),
          z: reader.readFloat32(),
          offset: reader.readFloat32()
        },
        miptex: reader.readUint32(),
        flags: reader.readUint32()
      })
    }
  }

  parseFaces(reader) {
    const lump = this.lumps[LUMP.FACES]
    reader.seek(lump.offset)
    const count = lump.length / 20 // sizeof(dface_t) = 20

    for (let i = 0; i < count; i++) {
      this.faces.push({
        planeNum: reader.readUint16(),
        side: reader.readUint16(),
        firstEdge: reader.readInt32(),
        numEdges: reader.readInt16(),
        texinfo: reader.readInt16(),
        styles: [
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8()
        ],
        lightOffset: reader.readInt32()
      })
    }
  }

  parseLighting(reader) {
    const lump = this.lumps[LUMP.LIGHTING]
    if (lump.length > 0) {
      reader.seek(lump.offset)
      this.lighting = reader.readBytes(lump.length)
    }
  }

  parseClipnodes(reader) {
    const lump = this.lumps[LUMP.CLIPNODES]
    reader.seek(lump.offset)
    const count = lump.length / 8 // sizeof(dclipnode_t) = 8

    for (let i = 0; i < count; i++) {
      this.clipnodes.push({
        planeNum: reader.readInt32(),
        children: [reader.readInt16(), reader.readInt16()]
      })
    }
  }

  parseLeaves(reader) {
    const lump = this.lumps[LUMP.LEAVES]
    reader.seek(lump.offset)
    const count = lump.length / 28 // sizeof(dleaf_t) = 28

    for (let i = 0; i < count; i++) {
      this.leaves.push({
        contents: reader.readInt32(),
        visOffset: reader.readInt32(),
        mins: [reader.readInt16(), reader.readInt16(), reader.readInt16()],
        maxs: [reader.readInt16(), reader.readInt16(), reader.readInt16()],
        firstMarksurface: reader.readUint16(),
        numMarksurfaces: reader.readUint16(),
        ambientLevel: [
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8()
        ]
      })
    }
  }

  parseMarksurfaces(reader) {
    const lump = this.lumps[LUMP.MARKSURFACES]
    reader.seek(lump.offset)
    const count = lump.length / 2 // sizeof(uint16) = 2

    for (let i = 0; i < count; i++) {
      this.marksurfaces.push(reader.readUint16())
    }
  }

  parseEdges(reader) {
    const lump = this.lumps[LUMP.EDGES]
    reader.seek(lump.offset)
    const count = lump.length / 4 // sizeof(dedge_t) = 4

    for (let i = 0; i < count; i++) {
      this.edges.push({
        v: [reader.readUint16(), reader.readUint16()]
      })
    }
  }

  parseSurfedges(reader) {
    const lump = this.lumps[LUMP.SURFEDGES]
    reader.seek(lump.offset)
    const count = lump.length / 4 // sizeof(int32) = 4

    for (let i = 0; i < count; i++) {
      this.surfedges.push(reader.readInt32())
    }
  }

  parseModels(reader) {
    const lump = this.lumps[LUMP.MODELS]
    reader.seek(lump.offset)
    const count = lump.length / 64 // sizeof(dmodel_t) = 64

    for (let i = 0; i < count; i++) {
      this.models.push({
        mins: reader.readVec3(),
        maxs: reader.readVec3(),
        origin: reader.readVec3(),
        headNodes: [
          reader.readInt32(),
          reader.readInt32(),
          reader.readInt32(),
          reader.readInt32()
        ],
        visLeafs: reader.readInt32(),
        firstFace: reader.readInt32(),
        numFaces: reader.readInt32()
      })
    }
  }

  getData() {
    return {
      version: this.version,
      entities: this.entities,
      planes: this.planes,
      textures: this.textures,
      vertices: this.vertices,
      visibility: this.visibility,
      nodes: this.nodes,
      texinfo: this.texinfo,
      faces: this.faces,
      lighting: this.lighting,
      clipnodes: this.clipnodes,
      leaves: this.leaves,
      marksurfaces: this.marksurfaces,
      edges: this.edges,
      surfedges: this.surfedges,
      models: this.models
    }
  }

  // Utility: Get vertices for a face
  getFaceVertices(faceIndex) {
    const face = this.faces[faceIndex]
    const vertices = []

    for (let i = 0; i < face.numEdges; i++) {
      const surfEdge = this.surfedges[face.firstEdge + i]
      const edge = this.edges[Math.abs(surfEdge)]

      // If surfEdge is negative, vertices are reversed
      const vertIndex = surfEdge >= 0 ? edge.v[0] : edge.v[1]
      vertices.push(this.vertices[vertIndex])
    }

    return vertices
  }

  // Utility: Calculate texture coordinates for a vertex on a face
  getTexCoords(vertex, texinfoIndex) {
    const ti = this.texinfo[texinfoIndex]
    const texture = this.textures[ti.miptex]

    if (!texture) return { u: 0, v: 0 }

    const u = (ti.s.x * vertex.x + ti.s.y * vertex.y + ti.s.z * vertex.z + ti.s.offset) / texture.width
    const v = (ti.t.x * vertex.x + ti.t.y * vertex.y + ti.t.z * vertex.z + ti.t.offset) / texture.height

    return { u, v }
  }

  // Utility: Get face normal
  getFaceNormal(faceIndex) {
    const face = this.faces[faceIndex]
    const plane = this.planes[face.planeNum]

    // If side is 1, flip the normal
    if (face.side) {
      return {
        x: -plane.normal.x,
        y: -plane.normal.y,
        z: -plane.normal.z
      }
    }
    return plane.normal
  }

  // Utility: Find entity by classname
  findEntitiesByClass(classname) {
    return this.entities.filter(e => e.classname === classname)
  }

  // Utility: Get player spawn point
  getSpawnPoint() {
    const spawns = this.findEntitiesByClass('info_player_start')
    if (spawns.length === 0) {
      // Try CT spawn for CS maps
      const ctSpawns = this.findEntitiesByClass('info_player_start')
      if (ctSpawns.length > 0) return this.parseOrigin(ctSpawns[0].origin)

      // Try T spawn
      const tSpawns = this.findEntitiesByClass('info_player_deathmatch')
      if (tSpawns.length > 0) return this.parseOrigin(tSpawns[0].origin)
    }

    if (spawns.length > 0) {
      return this.parseOrigin(spawns[0].origin)
    }

    return { x: 0, y: 0, z: 0 }
  }

  parseOrigin(originStr) {
    if (!originStr) return { x: 0, y: 0, z: 0 }
    const parts = originStr.split(' ').map(Number)
    return {
      x: parts[0] || 0,
      y: parts[1] || 0,
      z: parts[2] || 0
    }
  }
}

export default BSPParser
