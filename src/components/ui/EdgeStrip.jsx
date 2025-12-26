import React from 'react'
import TopoBorder from './TopoBorder'

/**
 * @param {Object} props
 * @param {'top' | 'left' | 'right' | 'bottom'} props.edge
 * @param {'hidden' | 'peek' | 'active'} props.visibility
 * @param {React.ReactNode} props.children
 */
export default function EdgeStrip({ edge, visibility, children }) {
    // Transform logic based on edge and visibility
    const getTransform = () => {
        if (visibility === 'hidden') {
            switch (edge) {
                case 'left': return 'translate(-100%, -50%)'
                case 'right': return 'translate(100%, -50%)'
                case 'top': return 'translate(-50%, -100%)'
                case 'bottom': return 'translateY(100%)'
            }
        }
        // Peek and Active share the same position, just different opacity/scale
        switch (edge) {
            case 'left': return 'translate(0, -50%)'
            case 'right': return 'translate(0, -50%)'
            case 'top': return 'translate(-50%, 0)'
            case 'bottom': return 'translateY(0)'
        }
    }

    const baseClasses = "fixed transition-all duration-300 ease-out z-10"
    const positionClasses = {
        top: "top-2 left-1/2",
        left: "left-2 top-1/2",
        right: "right-2 top-1/2",
        bottom: "bottom-0 left-0 right-0"
    }

    const opacity = visibility === 'hidden' ? 0 : (visibility === 'peek' ? 0.3 : 1)
    const scale = visibility === 'hidden' ? 0.75 : (visibility === 'peek' ? 0.9 : 1)
    const pointerEvents = visibility === 'active' ? 'auto' : 'none'

    const getDirectionClass = () => {
        switch (edge) {
            case 'left':
            case 'right':
                return 'flex-col'
            default:
                return 'flex-row'
        }
    }

    return (
        <div
            className={`${baseClasses} ${positionClasses[edge]}`}
            style={{
                transform: getTransform(),
                opacity,
                scale,
                pointerEvents
            }}
        >
            <TopoBorder>
                <div className={`flex bg-black/40 backdrop-blur-md border border-white/5 rounded-lg p-1 gap-1 shadow-2xl ${getDirectionClass()}`}>
                    {children}
                </div>
            </TopoBorder>
        </div>
    )
}
