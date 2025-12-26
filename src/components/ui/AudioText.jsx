import React from 'react'

/**
 * Renders text where each character reacts to a different audio frequency band.
 */
export default function AudioText({ text, className = '' }) {
    const bands = ['sub-bass', 'bass', 'low-mid', 'mid', 'high-mid', 'high']

    return (
        <span className={className}>
            {text.split('').map((char, i) => {
                const band = bands[i % bands.length]
                return (
                    <span
                        key={i}
                        className="inline-block transition-transform duration-75 ease-out"
                        style={{
                            transform: `translateY(calc(var(--audio-${band}) * var(--audio-reactive) * -4px))`,
                            opacity: `calc(0.6 + var(--audio-${band}) * 0.4)`
                        }}
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                )
            })}
        </span>
    )
}
