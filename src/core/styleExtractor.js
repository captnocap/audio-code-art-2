// Style Extractor - generates UI themes from audio characteristics
// Minimal stub implementation for uikit mode

class StyleExtractor {
    constructor() {
        this.samples = []
        this.startTime = null
        this.duration = 30000
        this.isAnalyzing = false
    }

    getDefaultTheme() {
        return {
            name: 'Default Theme',
            colors: {
                primary: '#8b5cf6',
                primaryLight: '#a78bfa',
                primaryDark: '#7c3aed',
                secondary: '#ec4899',
                accent: '#f59e0b',
                background: '#0a0a0a',
                foreground: '#ffffff',
                muted: '#6b7280',
                border: '#374151'
            },
            typography: {
                fontFamily: "'Inter', 'system-ui', sans-serif"
            },
            spacing: {
                unit: '0.25rem',
                xs: '0.5rem',
                sm: '0.75rem',
                md: '1rem',
                lg: '1.5rem',
                xl: '2rem'
            },
            radius: {
                sm: '4px',
                md: '8px',
                lg: '16px',
                full: '9999px'
            },
            borders: {
                width: '1px'
            },
            shadows: {
                sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            },
            animation: {
                duration: '200ms',
                easing: 'ease-in-out'
            },
            meta: {
                characteristics: 'default, neutral'
            },
            raw: {
                isDarkMode: true,
                avgLoudness: 0,
                avgBrightness: 0,
                avgTempo: 120,
                avgBass: 0,
                avgMid: 0,
                avgHigh: 0,
                dynamicRange: 0,
                avgRoughness: 0,
                sampleCount: 0
            }
        }
    }

    startAnalysis(duration = 30000) {
        this.samples = []
        this.startTime = Date.now()
        this.duration = duration
        this.isAnalyzing = true
    }

    captureFrame(audioFeatures, beatInfo) {
        if (!this.isAnalyzing) return false

        this.samples.push({
            ...audioFeatures,
            ...beatInfo,
            timestamp: Date.now()
        })

        const elapsed = Date.now() - this.startTime
        return elapsed < this.duration
    }

    getProgress() {
        if (!this.startTime) return 0
        const elapsed = Date.now() - this.startTime
        return Math.min(elapsed / this.duration, 1)
    }

    generateTheme(name = 'Audio Theme') {
        if (this.samples.length === 0) {
            return this.getDefaultTheme()
        }

        this.isAnalyzing = false

        // Calculate averages
        const avgAmplitude = this.samples.reduce((sum, s) => sum + (s.amplitude || 0), 0) / this.samples.length
        const avgBass = this.samples.reduce((sum, s) => sum + (s.bass || 0), 0) / this.samples.length
        const avgMid = this.samples.reduce((sum, s) => sum + (s.mid || 0), 0) / this.samples.length
        const avgHigh = this.samples.reduce((sum, s) => sum + (s.high || 0), 0) / this.samples.length
        const avgCentroid = this.samples.reduce((sum, s) => sum + (s.centroid || 0.5), 0) / this.samples.length
        const avgTempo = this.samples.reduce((sum, s) => sum + (s.tempo || 120), 0) / this.samples.length

        // Generate color from audio characteristics
        const hue = Math.floor(avgCentroid * 360)
        const saturation = Math.floor(50 + avgAmplitude * 30)
        const lightness = Math.floor(45 + avgHigh * 10)

        const primary = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        const primaryLight = `hsl(${hue}, ${saturation - 10}%, ${lightness + 10}%)`
        const primaryDark = `hsl(${hue}, ${saturation + 10}%, ${lightness - 10}%)`

        // Secondary color (complementary)
        const secondaryHue = (hue + 180) % 360
        const secondary = `hsl(${secondaryHue}, ${saturation}%, ${lightness}%)`

        // Accent (triadic)
        const accentHue = (hue + 120) % 360
        const accent = `hsl(${accentHue}, ${saturation + 10}%, ${lightness - 5}%)`

        // Dark or light mode based on brightness
        const isDark = avgCentroid < 0.5
        const background = isDark ? '#0a0a0a' : '#fafafa'
        const foreground = isDark ? '#ffffff' : '#1a1a1a'
        const muted = isDark ? '#6b7280' : '#9ca3af'
        const border = isDark ? '#374151' : '#e5e7eb'

        // Spacing based on tempo (faster = tighter)
        const spacingFactor = Math.max(0.7, Math.min(1.3, 120 / avgTempo))

        // Border radius based on bass (more bass = rounder)
        const radiusFactor = 1 + avgBass * 0.5

        // Characteristics
        const chars = []
        if (avgBass > 0.5) chars.push('bass-heavy')
        if (avgHigh > 0.5) chars.push('bright')
        if (avgAmplitude > 0.7) chars.push('energetic')
        if (avgTempo > 140) chars.push('fast')
        if (avgTempo < 90) chars.push('slow')

        return {
            name,
            colors: {
                primary,
                primaryLight,
                primaryDark,
                secondary,
                accent,
                background,
                foreground,
                muted,
                border
            },
            typography: {
                fontFamily: "'Inter', 'system-ui', sans-serif"
            },
            spacing: {
                unit: `${0.25 * spacingFactor}rem`,
                xs: `${0.5 * spacingFactor}rem`,
                sm: `${0.75 * spacingFactor}rem`,
                md: `${1 * spacingFactor}rem`,
                lg: `${1.5 * spacingFactor}rem`,
                xl: `${2 * spacingFactor}rem`
            },
            radius: {
                sm: `${4 * radiusFactor}px`,
                md: `${8 * radiusFactor}px`,
                lg: `${16 * radiusFactor}px`,
                full: '9999px'
            },
            borders: {
                width: avgBass > 0.6 ? '2px' : '1px'
            },
            shadows: {
                sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                md: `0 ${4 * radiusFactor}px ${6 * radiusFactor}px -1px rgba(0, 0, 0, 0.1)`,
                lg: `0 ${10 * radiusFactor}px ${15 * radiusFactor}px -3px rgba(0, 0, 0, 0.1)`
            },
            animation: {
                duration: `${200 / (avgTempo / 120)}ms`,
                easing: 'ease-in-out'
            },
            meta: {
                characteristics: chars.join(', ') || 'neutral'
            },
            raw: {
                isDarkMode: isDark,
                avgLoudness: avgAmplitude,
                avgBrightness: avgCentroid,
                avgTempo,
                avgBass,
                avgMid,
                avgHigh,
                dynamicRange: Math.max(...this.samples.map(s => s.amplitude || 0)) - Math.min(...this.samples.map(s => s.amplitude || 0)),
                avgRoughness: avgBass * avgHigh,
                sampleCount: this.samples.length
            }
        }
    }

    toCSS(theme) {
        return `:root {
  /* Colors */
  --color-primary: ${theme.colors.primary};
  --color-primary-light: ${theme.colors.primaryLight};
  --color-primary-dark: ${theme.colors.primaryDark};
  --color-secondary: ${theme.colors.secondary};
  --color-accent: ${theme.colors.accent};
  --color-background: ${theme.colors.background};
  --color-foreground: ${theme.colors.foreground};
  --color-muted: ${theme.colors.muted};
  --color-border: ${theme.colors.border};

  /* Typography */
  --font-family: ${theme.typography.fontFamily};

  /* Spacing */
  --spacing-unit: ${theme.spacing.unit};
  --spacing-xs: ${theme.spacing.xs};
  --spacing-sm: ${theme.spacing.sm};
  --spacing-md: ${theme.spacing.md};
  --spacing-lg: ${theme.spacing.lg};
  --spacing-xl: ${theme.spacing.xl};

  /* Radius */
  --radius-sm: ${theme.radius.sm};
  --radius-md: ${theme.radius.md};
  --radius-lg: ${theme.radius.lg};
  --radius-full: ${theme.radius.full};

  /* Borders */
  --border-width: ${theme.borders.width};

  /* Shadows */
  --shadow-sm: ${theme.shadows.sm};
  --shadow-md: ${theme.shadows.md};
  --shadow-lg: ${theme.shadows.lg};

  /* Animation */
  --animation-duration: ${theme.animation.duration};
  --animation-easing: ${theme.animation.easing};
}
`
    }

    toTailwind(theme) {
        return `/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: '${theme.colors.primary}',
        'primary-light': '${theme.colors.primaryLight}',
        'primary-dark': '${theme.colors.primaryDark}',
        secondary: '${theme.colors.secondary}',
        accent: '${theme.colors.accent}',
        background: '${theme.colors.background}',
        foreground: '${theme.colors.foreground}',
        muted: '${theme.colors.muted}',
        border: '${theme.colors.border}',
      },
      fontFamily: {
        sans: ${JSON.stringify(theme.typography.fontFamily.split(',').map(f => f.trim().replace(/'/g, '')))},
      },
      spacing: {
        xs: '${theme.spacing.xs}',
        sm: '${theme.spacing.sm}',
        md: '${theme.spacing.md}',
        lg: '${theme.spacing.lg}',
        xl: '${theme.spacing.xl}',
      },
      borderRadius: {
        sm: '${theme.radius.sm}',
        md: '${theme.radius.md}',
        lg: '${theme.radius.lg}',
        full: '${theme.radius.full}',
      },
    },
  },
}
`
    }
}

export const styleExtractor = new StyleExtractor()
