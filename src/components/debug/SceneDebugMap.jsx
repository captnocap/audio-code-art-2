import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

export default function SceneDebugMap({ enabled = true }) {
  const { camera, scene } = useThree()
  const canvasRef = useRef()
  const [isOpen, setIsOpen] = useState(true)

  // Store scene data
  const dataRef = useRef({
    camX: 0, camY: 0, camZ: 0,
    dirX: 0, dirY: 0, dirZ: 0,
    objects: []
  })

  // Update data every frame
  useFrame(() => {
    if (!enabled) return

    // Camera position
    dataRef.current.camX = camera.position.x
    dataRef.current.camY = camera.position.y
    dataRef.current.camZ = camera.position.z

    // Camera direction
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dataRef.current.dirX = dir.x
    dataRef.current.dirY = dir.y
    dataRef.current.dirZ = dir.z

    // Collect objects
    const objects = []
    scene.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const pos = new THREE.Vector3()
        obj.getWorldPosition(pos)

        let radius = 1
        if (obj.geometry.boundingSphere) {
          obj.geometry.computeBoundingSphere()
          radius = obj.geometry.boundingSphere.radius || 1
        }

        objects.push({
          x: pos.x,
          y: pos.y,
          z: pos.z,
          r: radius,
          type: obj.geometry.type || 'unknown'
        })
      }
    })
    dataRef.current.objects = objects
  })

  // Draw loop
  useEffect(() => {
    if (!enabled || !isOpen) return

    let animId
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        animId = requestAnimationFrame(draw)
        return
      }

      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height
      const data = dataRef.current

      // Clear
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      // Scale and center
      const scale = 4
      const cx = w / 2
      const cy = h / 2

      // Grid
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 1
      for (let i = -50; i <= 50; i += 10) {
        const gx = cx + i * scale
        const gy = cy - i * scale
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(w, gy)
        ctx.stroke()
      }

      // Origin axes
      ctx.lineWidth = 2
      ctx.strokeStyle = '#f00'
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + 20, cy)
      ctx.stroke()

      ctx.strokeStyle = '#00f'
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy + 20)
      ctx.stroke()

      // Draw objects (top-down: X vs Z)
      data.objects.forEach(obj => {
        const ox = cx + obj.x * scale
        const oy = cy - obj.z * scale  // -Z is forward
        const or = Math.max(3, Math.min(20, obj.r * scale))

        // Color by type
        if (obj.type.includes('Cylinder')) {
          ctx.fillStyle = '#0ff'
        } else if (obj.type.includes('Box')) {
          ctx.fillStyle = '#f00'
        } else if (obj.type.includes('Torus')) {
          ctx.fillStyle = '#f0f'
        } else if (obj.type.includes('Plane')) {
          ctx.fillStyle = '#0f0'
        } else {
          ctx.fillStyle = '#ff0'
        }

        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.arc(ox, oy, or, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // Camera position
      const camPx = cx + data.camX * scale
      const camPy = cy - data.camZ * scale

      // Camera body
      ctx.fillStyle = '#0f0'
      ctx.beginPath()
      ctx.arc(camPx, camPy, 6, 0, Math.PI * 2)
      ctx.fill()

      // Camera direction arrow
      const arrowLen = 25
      const arrowX = camPx + data.dirX * arrowLen
      const arrowY = camPy - data.dirZ * arrowLen

      ctx.strokeStyle = '#0f0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(camPx, camPy)
      ctx.lineTo(arrowX, arrowY)
      ctx.stroke()

      // Arrowhead
      const angle = Math.atan2(arrowY - camPy, arrowX - camPx)
      ctx.fillStyle = '#0f0'
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY)
      ctx.lineTo(arrowX - 8 * Math.cos(angle - 0.4), arrowY - 8 * Math.sin(angle - 0.4))
      ctx.lineTo(arrowX - 8 * Math.cos(angle + 0.4), arrowY - 8 * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fill()

      // Text info
      ctx.fillStyle = '#fff'
      ctx.font = '10px monospace'
      ctx.fillText(`CAM: ${data.camX.toFixed(1)}, ${data.camY.toFixed(1)}, ${data.camZ.toFixed(1)}`, 4, 12)
      ctx.fillText(`DIR: ${data.dirX.toFixed(2)}, ${data.dirY.toFixed(2)}, ${data.dirZ.toFixed(2)}`, 4, 24)
      ctx.fillText(`OBJ: ${data.objects.length}`, 4, 36)

      // Legend
      ctx.fillStyle = '#666'
      ctx.fillText('X→  -Z↓', 4, h - 4)

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [enabled, isOpen])

  if (!enabled) return null

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        className="fixed bottom-20 right-4 z-50"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -top-6 right-0 px-2 py-0.5 text-xs bg-black text-green-400 rounded-t border border-green-500/50 border-b-0 hover:bg-green-900/30"
        >
          {isOpen ? '▼ Debug' : '▲ Debug'}
        </button>
        {isOpen && (
          <canvas
            ref={canvasRef}
            width={180}
            height={180}
            className="block border border-green-500/50 rounded bg-black"
          />
        )}
      </div>
    </Html>
  )
}
