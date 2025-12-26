// Color = f(pitch, tempo)
// Pitch determines base hue (low = warm, high = cool)
// Tempo modulates saturation and shifts hue (fast = electric/vibrant, slow = earthy/muted)

export function pitchTempoToColor(normalizedPitch, normalizedTempo, amplitude = 1) {
    // Base hue from pitch - full 360° spectrum
    // Bass (0) -> Red/Orange (0-60)
    // Mid (0.3-0.6) -> Yellow/Green/Cyan (60-180)
    // High (0.6-1) -> Blue/Purple/Magenta (180-360)
    let baseHue
    if (normalizedPitch < 0.3) {
        // Bass: red to orange-yellow (0-60)
        baseHue = normalizedPitch / 0.3 * 60
    } else if (normalizedPitch < 0.6) {
        // Mid: yellow to cyan (60-180)
        baseHue = 60 + ((normalizedPitch - 0.3) / 0.3) * 120
    } else {
        // High: cyan to magenta, wrapping back toward red (180-360)
        baseHue = 180 + ((normalizedPitch - 0.6) / 0.4) * 180
    }

    // Tempo shifts hue slightly
    // Fast tempo (1) -> shifts toward cooler/electric (+20 hue)
    // Slow tempo (0) -> shifts toward warmer/earthy (-20 hue)
    const tempoHueShift = (normalizedTempo - 0.5) * 40
    let hue = baseHue + tempoHueShift

    // Keep hue in valid range
    if (hue < 0) hue += 360
    if (hue > 360) hue -= 360

    // Saturation: tempo increases vibrancy
    // Slow tempo = more muted (40-60%)
    // Fast tempo = more saturated (70-100%)
    const baseSaturation = 40 + normalizedTempo * 40
    const saturation = baseSaturation + amplitude * 20

    // Lightness based on amplitude
    // Quiet = darker, loud = brighter
    const lightness = 20 + amplitude * 50

    return `hsl(${hue.toFixed(1)}, ${Math.min(saturation, 100).toFixed(1)}%, ${Math.min(lightness, 90).toFixed(1)}%)`
}

export function pitchTempoToRGB(normalizedPitch, normalizedTempo, amplitude = 1) {
    const hsl = pitchTempoToColor(normalizedPitch, normalizedTempo, amplitude)
    return hslToRgb(hsl)
}

// Legacy function for backwards compatibility
export function frequencyToColor(normalizedFreq, amplitude = 1) {
    return pitchTempoToColor(normalizedFreq, 0.5, amplitude)
}

export function frequencyToRGB(normalizedFreq, amplitude = 1) {
    return pitchTempoToRGB(normalizedFreq, 0.5, amplitude)
}

function hslToRgb(hslString) {
    const match = hslString.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/)
    if (!match) return { r: 255, g: 255, b: 255 }

    let h = parseFloat(match[1]) / 360
    let s = parseFloat(match[2]) / 100
    let l = parseFloat(match[3]) / 100

    let r, g, b

    if (s === 0) {
        r = g = b = l
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1 / 6) return p + (q - p) * 6 * t
            if (t < 1 / 2) return q
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
            return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1 / 3)
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    }
}

// Create a color array from the full frequency spectrum with tempo influence
export function spectrumToColorArray(frequencies, normalizedTempo = 0.5, sampleCount = 32) {
    const colors = []
    const step = Math.floor(frequencies.length / sampleCount)

    for (let i = 0; i < sampleCount; i++) {
        const idx = i * step
        const magnitude = frequencies[idx] / 255
        const normalizedPitch = i / sampleCount
        colors.push({
            color: pitchTempoToColor(normalizedPitch, normalizedTempo, magnitude),
            rgb: pitchTempoToRGB(normalizedPitch, normalizedTempo, magnitude),
            magnitude,
            pitch: normalizedPitch
        })
    }

    return colors
}

// Get a single color based on dominant frequency and tempo
export function getDominantColor(audioFeatures, beatInfo) {
    const { dominantFrequency, amplitude } = audioFeatures
    const { normalizedTempo } = beatInfo

    return {
        color: pitchTempoToColor(dominantFrequency, normalizedTempo, amplitude),
        rgb: pitchTempoToRGB(dominantFrequency, normalizedTempo, amplitude)
    }
}
