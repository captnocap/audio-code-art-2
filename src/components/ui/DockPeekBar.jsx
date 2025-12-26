import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useModeStore } from '../../stores/modeStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import AudioText from './AudioText'
import TopoBorder from './TopoBorder'

function MiniBuff({ icon, label, active, color, hotkey, onClick }) {
    const [showTooltip, setShowTooltip] = useState(false)

    const colors = {
        violet: active ? 'bg-violet-500/80' : 'bg-white/10',
        amber: active ? 'bg-amber-500/80' : 'bg-white/10',
        green: active ? 'bg-emerald-500/80' : 'bg-white/10',
        cyan: active ? 'bg-cyan-500/80' : 'bg-white/10',
        blue: active ? 'bg-blue-500/80' : 'bg-white/10',
        red: active ? 'bg-red-500/80' : 'bg-white/10',
    }

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`
                    w-6 h-6 rounded flex items-center justify-center text-xs
                    transition-all hover:scale-110
                    ${colors[color] || colors.violet}
                    ${active ? 'shadow-sm' : 'opacity-50'}
                `}
            >
                {icon}
            </button>
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 rounded text-[10px] text-white whitespace-nowrap z-50">
                    {label} <kbd className="ml-1 px-1 bg-white/10 rounded text-white/60">{hotkey}</kbd>
                </div>
            )}
        </div>
    )
}

function PlayerControls({ onToggleRecord, onTogglePlay, isRecording, isPlaying, isPaused, progress, duration, onScrub }) {
    const [isDragging, setIsDragging] = useState(false)
    const progressRef = useRef(null)

    const handleMouseDown = useCallback((e) => {
        setIsDragging(true)
        e.stopPropagation()
    }, [])

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !progressRef.current) return
        const rect = progressRef.current.getBoundingClientRect()
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        onScrub(p)
    }, [isDragging, onScrub])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    const formatTime = (seconds) => {
        if (!seconds || !isFinite(seconds)) return '0:00'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const currentTime = formatTime(progress * duration)
    const totalTime = formatTime(duration)

    return (
        <div className="flex items-center gap-2 pl-3 border-l border-white/10" onClick={e => e.stopPropagation()}>
            <button
                onClick={onToggleRecord}
                className={`
                    w-5 h-5 rounded flex items-center justify-center text-[10px] transition-all
                    ${isRecording
                        ? 'bg-red-500/80 animate-pulse shadow-sm'
                        : 'bg-white/10 hover:bg-white/20'}
                `}
            >
                {isRecording ? '●' : '○'}
            </button>

            <button
                onClick={onTogglePlay}
                className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-[10px]"
            >
                {isPlaying && !isPaused ? '⏸' : '▶'}
            </button>

            <div
                ref={progressRef}
                className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group"
                onMouseDown={handleMouseDown}
            >
                <div
                    className="absolute inset-y-0 left-0 bg-violet-500/80 transition-all duration-75"
                    style={{ width: `${progress * 100}%` }}
                />
                <div
                    className={`
                        absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-sm
                        transition-opacity ${isDragging || progress > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    `}
                    style={{ left: `calc(${progress * 100}% - 5px)` }}
                />
            </div>

            <span className="text-[9px] text-white/50 font-mono select-none">
                {currentTime} / {totalTime}
            </span>
        </div>
    )
}

export default function DockPeekBar({
    isPinned,
    onTogglePin,
    onExpand,
    fxEnabled,
    godMode,
    debugEnabled,
    orbitEnabled,
    onToggleFX,
    onToggleGod,
    onToggleDebug,
    onResetCamera
}) {
    const getCurrentMode = useModeStore(s => s.getCurrentMode)
    const mode = getCurrentMode()

    const {
        isRecording,
        isPlaying,
        isPaused,
        getProgress,
        toggleRecording,
        startPlayback,
        pausePlayback,
        seekToProgress,
        getFormattedTime
    } = usePlaybackStore()

    const progress = getProgress ? getProgress() : 0
    const time = getFormattedTime ? getFormattedTime() : { current: '0:00', total: '0:00' }

    const handleRecordToggle = useCallback(() => {
        toggleRecording()
    }, [toggleRecording])

    const handlePlayToggle = useCallback(() => {
        if (isPlaying && !isPaused) {
            pausePlayback()
        } else {
            startPlayback()
        }
    }, [isPlaying, isPaused, startPlayback, pausePlayback])

    const handleScrub = useCallback((p) => {
        seekToProgress(p)
    }, [seekToProgress])

    const hasRecording = useCallback(() => {
        return usePlaybackStore.getState().recordedFrames?.length > 0
    }, [])

    const duration = time.total !== '0:00' ? parseFloat(time.total) || 0 : 0

    return (
        <TopoBorder className="w-full">
            <div
                className="h-10 w-full bg-black/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={onExpand}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse"></div>
                    <span className="text-[11px] font-medium text-white/90 tracking-wide uppercase">
                        <AudioText text={mode?.name || 'Loading...'} />
                    </span>
                </div>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <MiniBuff
                        icon="✨"
                        label="Post-FX"
                        active={fxEnabled}
                        color="violet"
                        hotkey="F"
                        onClick={onToggleFX}
                    />
                    <MiniBuff
                        icon="👁"
                        label="God Mode"
                        active={godMode}
                        color="amber"
                        hotkey="G"
                        onClick={onToggleGod}
                    />
                    {orbitEnabled && !godMode && (
                        <MiniBuff
                            icon="🎯"
                            label="Orbit (Mode)"
                            active={true}
                            color="blue"
                            hotkey=""
                        />
                    )}
                    <MiniBuff
                        icon="🗺"
                        label="Debug Map"
                        active={debugEnabled}
                        color="green"
                        hotkey="D"
                        onClick={onToggleDebug}
                    />
                    <MiniBuff
                        icon="↺"
                        label="Reset Cam"
                        active={false}
                        color="cyan"
                        hotkey="R"
                        onClick={onResetCamera}
                    />

                    <div className="w-px h-4 bg-white/20 mx-1" />

                    <div className="flex gap-0.5 opacity-80">
                        <div className="w-6 h-1.5 bg-white/10 rounded-sm overflow-hidden relative">
                            <div className="absolute inset-0 bg-red-400/60 origin-left" style={{ transform: 'scaleX(var(--audio-bass, 0.3))' }}></div>
                        </div>
                        <div className="w-6 h-1.5 bg-white/10 rounded-sm overflow-hidden relative">
                            <div className="absolute inset-0 bg-yellow-400/60 origin-left" style={{ transform: 'scaleX(var(--audio-mid, 0.5))' }}></div>
                        </div>
                        <div className="w-6 h-1.5 bg-white/10 rounded-sm overflow-hidden relative">
                            <div className="absolute inset-0 bg-green-400/60 origin-left" style={{ transform: 'scaleX(var(--audio-high, 0.4))' }}></div>
                        </div>
                    </div>

                    <PlayerControls
                        onToggleRecord={handleRecordToggle}
                        onTogglePlay={handlePlayToggle}
                        isRecording={isRecording}
                        isPlaying={isPlaying}
                        isPaused={isPaused}
                        progress={progress}
                        duration={duration}
                        onScrub={handleScrub}
                    />
                </div>

                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={onTogglePin}
                        className={`text-[10px] transition-colors flex items-center gap-1 ${isPinned ? 'text-white' : 'text-white/40 hover:text-white'}`}
                    >
                        {isPinned ? (
                            <span className="text-xs">📌</span>
                        ) : (
                            <span className="opacity-50">PIN</span>
                        )}
                    </button>
                </div>
            </div>
        </TopoBorder>
    )
}
