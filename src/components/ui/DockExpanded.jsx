import React, { useState } from 'react'
import { useModeStore } from '../../stores/modeStore'
import { useFXStore } from '../../stores/fxStore'
import { useModMatrixStore } from '../../stores/modMatrixStore'
import ParamControl from './ParamControl'
import OutputPanel from './OutputPanel'
import { useTour } from './OnboardingTour'
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

// Sortable FX chip for drag reordering
function SortableFXChip({ fx, effect, onToggle, onSelect, isSelected }) {
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
                ${fx.enabled ? 'bg-violet-600/80 border-violet-400/50' : 'bg-white/10 border-white/10'}
                ${isSelected ? 'ring-2 ring-white/50' : ''}
                border
            `}
        >
            <div className="flex items-center gap-2 px-3 py-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle() }}
                    className={`w-3 h-3 rounded-full border transition-colors ${
                        fx.enabled
                            ? 'bg-green-400 border-green-300'
                            : 'bg-transparent border-white/30'
                    }`}
                />
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect() }}
                    className="text-[11px] font-medium text-white hover:text-white/80"
                >
                    {effect?.name || fx.id}
                </button>
            </div>
        </div>
    )
}

// Mod Matrix cell component
function ModCell({ source, destination, amount, hasRoute, onAdd, onRemove, onChange }) {
    const [editing, setEditing] = useState(false)

    if (!hasRoute) {
        return (
            <button
                onClick={onAdd}
                className="w-6 h-6 rounded border border-white/10 hover:border-white/30 transition-colors flex items-center justify-center"
            >
                <span className="text-white/20 text-lg">+</span>
            </button>
        )
    }

    return (
        <div className="relative group">
            <button
                onClick={() => setEditing(!editing)}
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono"
                style={{
                    backgroundColor: source.color + Math.round(Math.abs(amount) * 127 + 40).toString(16).padStart(2, '0'),
                    color: Math.abs(amount) > 0.5 ? '#000' : '#fff'
                }}
            >
                {amount.toFixed(1)}
            </button>

            <button
                onClick={onRemove}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
                ×
            </button>

            {editing && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg z-50 min-w-24">
                    <input
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={amount}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="text-center text-xs text-white/60 mt-1">
                        {amount.toFixed(2)}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function DockExpanded() {
    const { getCurrentMode, getParamValue, setParamValue } = useModeStore()
    const { chain, effects, toggleEffect, reorderEffects, getUniformValue, setUniformValue, addEffect } = useFXStore()
    const { sources, routes, addRoute, removeRoute, setRouteAmount } = useModMatrixStore()
    const { startTour } = useTour()
    const mode = getCurrentMode()
    const [activeTab, setActiveTab] = useState('params')
    const [selectedFX, setSelectedFX] = useState(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    if (!mode) return null

    const groups = {}
    Object.entries(mode.params).forEach(([key, def]) => {
        const group = 'Parameters'
        if (!groups[group]) groups[group] = []
        groups[group].push({ id: key, ...def })
    })

    const handleDragEnd = (event) => {
        const { active, over } = event
        if (active.id !== over?.id) {
            const oldIndex = chain.findIndex((fx) => fx.id === active.id)
            const newIndex = chain.findIndex((fx) => fx.id === over.id)
            reorderEffects(oldIndex, newIndex)
        }
    }

    const handleRandomize = () => {
        if (activeTab === 'params') {
            if (!groups['Parameters']) return
            groups['Parameters'].forEach(param => {
                if (param.type === 'number') {
                    const min = param.min ?? 0
                    const max = param.max ?? 1
                    const random = Math.random() * (max - min) + min
                    setParamValue(param.id, random)
                } else if (param.type === 'expression') {
                    const vars = ['bass', 'mid', 'high', 'amplitude', 'beat']
                    const ops = ['+', '-', '*']
                    const base = (Math.random() * 2).toFixed(1)
                    const varName = vars[Math.floor(Math.random() * vars.length)]
                    const op = ops[Math.floor(Math.random() * ops.length)]
                    const multiplier = (Math.random() * 3).toFixed(1)
                    setParamValue(param.id, `${base} ${op} ${varName} * ${multiplier}`)
                }
            })
        }
    }

    const handleReset = () => {
        if (activeTab === 'params') {
            if (!groups['Parameters']) return
            groups['Parameters'].forEach(param => {
                if (param.default !== undefined) {
                    setParamValue(param.id, param.default)
                }
            })
        }
    }

    // Available effects not in chain
    const availableEffects = Object.keys(effects).filter(
        id => !chain.find(fx => fx.id === id)
    )

    // Selected effect details
    const selectedEffect = selectedFX ? effects[selectedFX] : null

    return (
        <div className="w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 p-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="max-w-5xl mx-auto flex gap-6">
                {/* Tab Navigation */}
                <div className="w-32 flex-shrink-0 border-r border-white/10 pr-4">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Groups</div>
                    <div className="space-y-1">
                        <button
                            onClick={() => { setActiveTab('params'); setSelectedFX(null) }}
                            className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                                activeTab === 'params'
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'hover:bg-white/5 text-white/60'
                            }`}
                        >
                            Parameters
                        </button>
                        <button
                            onClick={() => { setActiveTab('fx'); setSelectedFX(null) }}
                            className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                                activeTab === 'fx'
                                    ? 'bg-violet-600/50 text-white font-medium'
                                    : 'hover:bg-white/5 text-white/60'
                            }`}
                        >
                            FX Stack
                        </button>
                        <button
                            onClick={() => { setActiveTab('mod'); setSelectedFX(null) }}
                            className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                                activeTab === 'mod'
                                    ? 'bg-cyan-600/50 text-white font-medium'
                                    : 'hover:bg-white/5 text-white/60'
                            }`}
                        >
                            Mod Matrix
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Parameters Tab */}
                    {activeTab === 'params' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                            {groups['Parameters'] && groups['Parameters'].length > 0 ? (
                                groups['Parameters'].map(param => (
                                    <ParamControl
                                        key={param.id}
                                        param={param}
                                        value={getParamValue(param.id)}
                                        onChange={(val) => setParamValue(param.id, val)}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full text-center text-white/40 text-sm py-8">
                                    No parameters available for this mode
                                </div>
                            )}
                        </div>
                    )}

                    {/* FX Stack Tab */}
                    {activeTab === 'fx' && (
                        <div className="space-y-4">
                            {/* FX Chain - Draggable */}
                            <div>
                                <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                    Effect Chain (drag to reorder)
                                </div>
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={chain.map((fx) => fx.id)}
                                        strategy={horizontalListSortingStrategy}
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            {chain.map((fx) => (
                                                <SortableFXChip
                                                    key={fx.id}
                                                    fx={fx}
                                                    effect={effects[fx.id]}
                                                    onToggle={() => toggleEffect(fx.id)}
                                                    onSelect={() => setSelectedFX(selectedFX === fx.id ? null : fx.id)}
                                                    isSelected={selectedFX === fx.id}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>

                            {/* Add Effects */}
                            {availableEffects.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                        Add Effect
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableEffects.map(id => (
                                            <button
                                                key={id}
                                                onClick={() => addEffect(id)}
                                                className="px-3 py-1.5 rounded border border-dashed border-white/20 text-[11px] text-white/50 hover:border-violet-400/50 hover:text-white/80 transition-colors"
                                            >
                                                + {effects[id].name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Selected Effect Uniforms */}
                            {selectedEffect && (
                                <div className="border-t border-white/10 pt-4">
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                        {selectedEffect.name} Uniforms
                                    </div>
                                    <p className="text-[10px] text-white/40 mb-3">{selectedEffect.description}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                                        {Object.entries(selectedEffect.uniforms).map(([name, uniform]) => (
                                            <div key={name} className="space-y-1">
                                                <label className="text-[10px] text-white/60 capitalize block">
                                                    {name.replace(/([A-Z])/g, ' $1').trim()}
                                                </label>
                                                {uniform.type === 'expression' ? (
                                                    <input
                                                        type="text"
                                                        value={getUniformValue(selectedFX, name)}
                                                        onChange={(e) => setUniformValue(selectedFX, name, e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-violet-300 focus:border-violet-500 outline-none"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="range"
                                                            min={uniform.min}
                                                            max={uniform.max}
                                                            step={uniform.step}
                                                            value={getUniformValue(selectedFX, name)}
                                                            onChange={(e) => setUniformValue(selectedFX, name, parseFloat(e.target.value))}
                                                            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                                                        />
                                                        <span className="text-[10px] text-white/50 font-mono w-12 text-right">
                                                            {Number(getUniformValue(selectedFX, name)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mod Matrix Tab */}
                    {activeTab === 'mod' && (
                        <div className="space-y-4">
                            {/* Matrix Grid */}
                            <div>
                                <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                    Audio → Parameter Routing
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr>
                                                <th className="p-1 text-left text-white/40 sticky left-0 bg-black/80">Source</th>
                                                {Object.keys(groups['Parameters'] || {}).length > 0 ? (
                                                    groups['Parameters'].map((param) => (
                                                        <th
                                                            key={param.id}
                                                            className="p-1 text-center text-white/40 truncate max-w-16"
                                                            title={param.id}
                                                        >
                                                            {param.id.slice(0, 6)}
                                                        </th>
                                                    ))
                                                ) : (
                                                    <th className="p-1 text-center text-white/30">No params</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sources.map((source) => (
                                                <tr key={source.id}>
                                                    <td className="p-1 sticky left-0 bg-black/80">
                                                        <span
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                                                            style={{ backgroundColor: source.color + '40', color: source.color }}
                                                        >
                                                            {source.name}
                                                        </span>
                                                    </td>
                                                    {groups['Parameters'] && groups['Parameters'].map((param) => {
                                                        const route = routes.find(
                                                            (r) => r.source === source.id && r.destination === param.id
                                                        )
                                                        const amount = route?.amount || 0

                                                        return (
                                                            <td key={param.id} className="p-1">
                                                                <ModCell
                                                                    source={source}
                                                                    destination={param.id}
                                                                    amount={amount}
                                                                    hasRoute={!!route}
                                                                    onAdd={() => addRoute(source.id, param.id, 0.5)}
                                                                    onRemove={() => removeRoute(source.id, param.id)}
                                                                    onChange={(val) => setRouteAmount(source.id, param.id, val)}
                                                                />
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Active Routes Summary */}
                            {routes.length > 0 && (
                                <div className="border-t border-white/10 pt-3">
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                        Active Routes ({routes.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {routes.map((route, i) => {
                                            const source = sources.find(s => s.id === route.source)
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10"
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: source?.color }}
                                                    />
                                                    <span className="text-[10px] text-white/70">
                                                        {route.source} → {route.destination}
                                                    </span>
                                                    <span className="text-[10px] text-cyan-400 font-mono">
                                                        {route.amount > 0 ? '+' : ''}{route.amount.toFixed(1)}
                                                    </span>
                                                    <button
                                                        onClick={() => removeRoute(route.source, route.destination)}
                                                        className="text-white/30 hover:text-red-400 text-xs"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Help text when no params */}
                            {(!groups['Parameters'] || groups['Parameters'].length === 0) && (
                                <div className="text-center text-white/30 text-[11px] py-4">
                                    This mode has no parameters to modulate
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Actions */}
                <div className="w-48 flex-shrink-0 border-l border-white/10 pl-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleRandomize}
                            disabled={activeTab !== 'params'}
                            className={`w-full py-1.5 rounded border border-white/10 bg-white/5 text-[10px] transition-colors ${
                                activeTab === 'params'
                                    ? 'hover:bg-white/10 text-white/80'
                                    : 'text-white/30 cursor-not-allowed'
                            }`}
                        >
                            🎲 Randomize
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={activeTab !== 'params'}
                            className={`w-full py-1.5 rounded border border-white/10 bg-white/5 text-[10px] transition-colors ${
                                activeTab === 'params'
                                    ? 'hover:bg-white/10 text-white/80'
                                    : 'text-white/30 cursor-not-allowed'
                            }`}
                        >
                            ↺ Reset
                        </button>
                    </div>

                    <div className="border-t border-white/10 pt-2">
                        <button
                            onClick={startTour}
                            className="w-full py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/60 transition-colors"
                        >
                            📚 Restart Tour
                        </button>
                    </div>

                    <div className="border-t border-white/10 pt-2">
                        <OutputPanel />
                    </div>
                </div>
            </div>
        </div>
    )
}
