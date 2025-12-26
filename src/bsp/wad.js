/**
 * GoldSrc WAD3 Parser
 * Parses Half-Life texture archives (.wad files)
 *
 * Based on hlbsp-web by Bernhard Gruber
 * Reference: https://developer.valvesoftware.com/wiki/WAD
 */

const WAD3_MAGIC = 0x33444157 // "WAD3" in little endian

const MIPTYPE = {
  PALETTE: 0x40,
  MIPTEX: 0x43,    // Embedded miptex
  FONT: 0x45
}

class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.offset = 0
  }

  seek(offset) {
    this.offset = offset
  }

  readUint8() {
    const val = this.view.getUint8(this.offset)
    this.offset += 1
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

  readString(length) {
    const bytes = new Uint8Array(this.buffer, this.offset, length)
    this.offset += length
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

export class WADParser {
  constructor() {
    this.textures = new Map()
  }

  async parse(arrayBuffer) {
    const reader = new BinaryReader(arrayBuffer)

    // Read header
    const magic = reader.readUint32()
    if (magic !== WAD3_MAGIC) {
      throw new Error('Invalid WAD file: bad magic number')
    }

    const numLumps = reader.readInt32()
    const dirOffset = reader.readInt32()

    // Read directory
    reader.seek(dirOffset)
    const lumps = []
    for (let i = 0; i < numLumps; i++) {
      lumps.push({
        offset: reader.readInt32(),
        diskSize: reader.readInt32(),
        size: reader.readInt32(),
        type: reader.readUint8(),
        compression: reader.readUint8(),
        padding: reader.readUint8() + reader.readUint8(),
        name: reader.readString(16).toUpperCase()
      })
    }

    // Parse miptex lumps
    for (const lump of lumps) {
      if (lump.type === MIPTYPE.MIPTEX) {
        const texture = this.parseMiptex(reader, lump)
        if (texture) {
          this.textures.set(lump.name, texture)
        }
      }
    }

    return this.textures
  }

  parseMiptex(reader, lump) {
    reader.seek(lump.offset)

    const name = reader.readString(16)
    const width = reader.readUint32()
    const height = reader.readUint32()

    // Mipmap offsets (relative to lump.offset)
    const mipOffsets = [
      reader.readUint32(),
      reader.readUint32(),
      reader.readUint32(),
      reader.readUint32()
    ]

    // Calculate mip sizes
    const mipSizes = [
      width * height,
      (width / 2) * (height / 2),
      (width / 4) * (height / 4),
      (width / 8) * (height / 8)
    ]
    const totalMipSize = mipSizes.reduce((a, b) => a + b, 0)

    // Read mip0 pixel data (palette indices)
    if (mipOffsets[0] === 0) return null

    reader.seek(lump.offset + mipOffsets[0])
    const indices = reader.readBytes(mipSizes[0])

    // Read palette (after all mips + 2 byte padding)
    reader.seek(lump.offset + mipOffsets[0] + totalMipSize + 2)
    const palette = reader.readBytes(256 * 3)

    // Convert to RGBA
    const pixels = new Uint8Array(width * height * 4)
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i]
      const paletteOffset = idx * 3
      pixels[i * 4 + 0] = palette[paletteOffset + 0]
      pixels[i * 4 + 1] = palette[paletteOffset + 1]
      pixels[i * 4 + 2] = palette[paletteOffset + 2]
      // Last palette entry (255) is typically transparent for decals
      pixels[i * 4 + 3] = idx === 255 ? 0 : 255
    }

    return {
      name,
      width,
      height,
      pixels
    }
  }

  getTexture(name) {
    return this.textures.get(name.toUpperCase())
  }
}

export default WADParser
