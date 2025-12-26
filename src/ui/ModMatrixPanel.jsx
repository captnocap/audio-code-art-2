import { useState } from 'react'
import { useModMatrixStore } from '../stores/modMatrixStore'
import { useModeStore } from '../stores/modeStore'

export default function ModMatrixPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { sources, routes, addRoute, removeRoute, setRouteAmount } = useModMatrixStore()
  const { getCurrentParams } = useModeStore()

  const params = getCurrentParams()
  const destinations = Object.keys(params)

  return (
    <div
      className="absolute right-0 top-1/2 -translate-y-1/2 z-40"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          glass-panel rounded-l-xl transition-all duration-300 ease-out overflow-hidden
          ${isExpanded ? 'w-80 p-3' : 'w-10 p-2'}
        `}
      >
        {/* Collapsed state */}
        {!isExpanded && (
          <div className="flex flex-col items-center gap-1 text-white/40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] writing-mode-vertical">MOD</span>
          </div>
        )}

        {/* Expanded state */}
        {isExpanded && (
          <>
            <h3 className="text-sm font-medium mb-3">Mod Matrix</h3>

            {/* Matrix grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-white/40">Source</th>
                    {destinations.map((dest) => (
                      <th
                        key={dest}
                        className="p-1 text-center text-white/40 truncate max-w-16"
                        title={dest}
                      >
                        {dest.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id}>
                      <td className="p-1">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: source.color + '40', color: source.color }}
                        >
                          {source.name}
                        </span>
                      </td>
                      {destinations.map((dest) => {
                        const route = routes.find(
                          (r) => r.source === source.id && r.destination === dest
                        )
                        const amount = route?.amount || 0

                        return (
                          <td key={dest} className="p-1">
                            <ModCell
                              source={source}
                              destination={dest}
                              amount={amount}
                              hasRoute={!!route}
                              onAdd={() => addRoute(source.id, dest, 0.5)}
                              onRemove={() => removeRoute(source.id, dest)}
                              onChange={(val) => setRouteAmount(source.id, dest, val)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Active routes summary */}
            {routes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <h4 className="text-xs text-white/40 mb-2">Active Routes</h4>
                <div className="space-y-1">
                  {routes.slice(0, 5).map((route, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-violet-400">{route.source}</span>
                      <span className="text-white/30">→</span>
                      <span className="text-white/70">{route.destination}</span>
                      <span className="text-white/30 ml-auto">{route.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {routes.length > 5 && (
                    <div className="text-white/30 text-xs">
                      +{routes.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

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
          backgroundColor: source.color + Math.round(amount * 255).toString(16).padStart(2, '0'),
          color: amount > 0.5 ? '#000' : '#fff'
        }}
      >
        {amount.toFixed(1)}
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        ×
      </button>

      {/* Amount slider popup */}
      {editing && (
        <div className="absolute top-full left-0 mt-1 p-2 glass-panel rounded-lg z-50 min-w-24">
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={amount}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
          />
          <div className="text-center text-xs text-white/60 mt-1">
            {amount.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}
