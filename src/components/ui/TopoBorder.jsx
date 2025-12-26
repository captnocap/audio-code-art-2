import React from 'react'

/**
 * Wraps content with an audio-reactive topographic border.
 * Note: Requires parent to have relative positioning.
 */
export default function TopoBorder({ children, className = '' }) {
    // We need to render the SVG layers behind the content.
    // The spec says:
    // <div class="topo-border">
    //   <svg class="topo-layer" data-depth="5"><!-- sub-bass --></svg>
    //   ...
    //   <div class="topo-content"><!-- actual content --></div>
    // </div>

    // Since we can't easily know the exact path of the border for arbitrary children without ResizeObserver 
    // and complex SVG path generation, we'll approximate with a rounded rect for now, 
    // or assume the parent is a rounded box.

    // For the EdgeStrips and Dock, they are rounded rectangles.
    // We can use a simple rect in the SVG.

    const layers = [
        { depth: 5, freq: 'sub-bass', color: 'hsl(260, 70%, 25%)', blur: 3, opacity: 0.4, scale: 8 },
        { depth: 4, freq: 'bass', color: 'hsl(270, 65%, 35%)', blur: 2, opacity: 0.5, scale: 6 },
        { depth: 3, freq: 'low-mid', color: 'hsl(280, 60%, 45%)', blur: 1.5, opacity: 0.6, scale: 5 },
        { depth: 2, freq: 'mid', color: 'hsl(290, 55%, 55%)', blur: 1, opacity: 0.7, scale: 4 },
        { depth: 1, freq: 'high-mid', color: 'hsl(300, 50%, 65%)', blur: 0.5, opacity: 0.8, scale: 3 },
        { depth: 0, freq: 'high', color: 'hsl(310, 45%, 80%)', blur: 0, opacity: 1, scale: 0 } // Surface
    ]

    return (
        <div className={`relative ${className}`}>
            {/* Layers */}
            {layers.map((l) => (
                <svg
                    key={l.depth}
                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                    style={{
                        zIndex: -1 - l.depth, // Stack behind
                        filter: `blur(calc(var(--audio-${l.freq}) * ${l.blur}px))`,
                        opacity: `calc(${l.opacity} + var(--audio-${l.freq}) * ${1 - l.opacity})`,
                        transform: `translate(
              calc(${l.depth} * var(--audio-${l.freq}) * var(--audio-reactive) * ${l.scale}px),
              calc(${l.depth} * var(--audio-${l.freq}) * var(--audio-reactive) * ${l.scale}px)
            )`,
                        transition: `all ${20 + l.depth * 25}ms ease-out`
                    }}
                >
                    <rect
                        x="0" y="0" width="100%" height="100%" rx="8" ry="8" // Assuming rounded-lg (8px)
                        fill="none"
                        stroke={l.color}
                        strokeWidth={l.depth === 0 ? 'calc(1.5px + var(--audio-high) * var(--audio-reactive) * 2px)' : '1.5'}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            ))}

            {/* Content */}
            <div className="relative z-0">
                {children}
            </div>
        </div>
    )
}
