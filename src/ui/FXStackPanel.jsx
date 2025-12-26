import { useState } from 'react'
import { useFXStore } from '../stores/fxStore'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function FXStackPanel() {
  const { chain, effects, toggleEffect, reorderEffects } = useFXStore()
  const [expandedFX, setExpandedFX] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = chain.findIndex((fx) => fx.id === active.id)
      const newIndex = chain.findIndex((fx) => fx.id === over.id)
      reorderEffects(oldIndex, newIndex)
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-panel rounded-xl p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chain.map((fx) => fx.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-2">
              {chain.map((fx) => (
                <SortableFXChip
                  key={fx.id}
                  fx={fx}
                  effect={effects[fx.id]}
                  isExpanded={expandedFX === fx.id}
                  onToggle={() => toggleEffect(fx.id)}
                  onExpand={() => setExpandedFX(expandedFX === fx.id ? null : fx.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* FX Details Panel */}
      {expandedFX && effects[expandedFX] && (
        <FXDetailPanel
          effectId={expandedFX}
          effect={effects[expandedFX]}
          onClose={() => setExpandedFX(null)}
        />
      )}
    </div>
  )
}

function SortableFXChip({ fx, effect, isExpanded, onToggle, onExpand }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fx.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        rounded-lg transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-80 scale-105' : ''}
        ${fx.enabled ? 'bg-violet-600' : 'bg-white/10'}
      `}
    >
      <div className="flex items-center gap-1 px-3 py-2">
        {/* Enable toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={`w-3 h-3 rounded-full border transition-colors ${
            fx.enabled
              ? 'bg-green-400 border-green-300'
              : 'bg-transparent border-white/30'
          }`}
        />

        {/* Effect name */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onExpand()
          }}
          className="text-sm font-medium text-white hover:text-white/80 transition-colors"
        >
          {effect?.name || fx.id}
        </button>

        {/* Expand indicator */}
        <svg
          className={`w-3 h-3 text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

function FXDetailPanel({ effectId, effect, onClose }) {
  const { getUniformValue, setUniformValue } = useFXStore()

  return (
    <div className="glass-panel rounded-xl p-3 mt-2 min-w-64">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{effect.name}</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-white/50 mb-3">{effect.description}</p>

      <div className="space-y-2">
        {Object.entries(effect.uniforms).map(([name, uniform]) => (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/60 capitalize">
                {name.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            </div>

            {uniform.type === 'expression' ? (
              <input
                type="text"
                value={getUniformValue(effectId, name)}
                onChange={(e) => setUniformValue(effectId, name, e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:border-violet-500 outline-none"
              />
            ) : (
              <input
                type="range"
                min={uniform.min}
                max={uniform.max}
                step={uniform.step}
                value={getUniformValue(effectId, name)}
                onChange={(e) => setUniformValue(effectId, name, parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
