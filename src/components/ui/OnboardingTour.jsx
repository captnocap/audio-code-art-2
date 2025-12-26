import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * Onboarding Tour Component
 *
 * - Blurs/dims the page
 * - Spotlights UI regions with a "hole" effect
 * - Animated tooltips with descriptions
 * - Step navigation (Next / Skip / keyboard)
 * - localStorage to remember completion
 * @typedef {Object} SpotlightRegion
 * @property {"edge" | "rect" | "center"} type
 * @property {"left" | "top" | "right" | "bottom"} [edge]
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [padding]
 */

/**
 * @typedef {Object} TourStep
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {SpotlightRegion} region
 * @property {"top" | "bottom" | "left" | "right" | "center"} tooltipPosition
 * @property {() => void} [triggerVisibility]
 * @property {string} [actionText]
 */

// ============================================================================
// Default tour steps for the visualizer UI
// ============================================================================

export const VISUALIZER_TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Audio Canvas",
    description: "The interface is designed to disappear. The visualization is the star. Move your mouse to the edges to bring controls back.",
    region: { type: "center" },
    tooltipPosition: "center",
  },
  {
    id: "top-modes",
    title: "2D & 3D Modes",
    description: "Move your mouse to the TOP edge to reveal visualization modes. Flow fields, wormholes, nebulas, and more.",
    region: { type: "edge", edge: "top", padding: 20 },
    tooltipPosition: "bottom",
  },
  {
    id: "left-modes",
    title: "Experimental Modes",
    description: "The LEFT edge holds experimental and glitchy modes. Corruption, feedback loops, hallucinations — the weird stuff.",
    region: { type: "edge", edge: "left", padding: 20 },
    tooltipPosition: "right",
  },
  {
    id: "right-modes",
    title: "Game Modes",
    description: "RIGHT edge has interactive game modes. Audio-reactive Tetris, highway racer, and more.",
    region: { type: "edge", edge: "right", padding: 20 },
    tooltipPosition: "left",
  },
  {
    id: "dock",
    title: "The Dock",
    description: "Move to the BOTTOM edge for the control dock. Adjust parameters, see audio levels, record and screenshot. Pin it open with the 📌 button.",
    region: { type: "edge", edge: "bottom", padding: 40 },
    tooltipPosition: "top",
  },
  {
    id: "keyboard",
    title: "Keyboard Shortcuts",
    description: "Space to play/pause, R to record, S to screenshot, F for fullscreen, Tab to toggle dock. Numbers 1-9 switch modes.",
    region: { type: "center" },
    tooltipPosition: "center",
  },
  {
    id: "done",
    title: "You're all set!",
    description: "The UI hides after 2 seconds of inactivity. Just move your mouse to bring it back. Now go make something beautiful.",
    region: { type: "center" },
    tooltipPosition: "center",
    actionText: "Let's go",
  },
];

// ============================================================================
// Utilities
// ============================================================================

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function getRegionBounds(region) {
  const padding = region.padding ?? 10;
  const w = typeof window !== "undefined" ? window.innerWidth : 1920;
  const h = typeof window !== "undefined" ? window.innerHeight : 1080;

  if (region.type === "center") {
    const size = 300;
    return {
      x: w / 2 - size / 2,
      y: h / 2 - size / 2,
      width: size,
      height: size,
    };
  }

  if (region.type === "edge") {
    const edgeSize = 60;
    switch (region.edge) {
      case "top":
        return { x: w * 0.2, y: 0, width: w * 0.6, height: edgeSize + padding };
      case "bottom":
        return { x: 0, y: h - 120 - padding, width: w, height: 120 + padding };
      case "left":
        return { x: 0, y: h * 0.25, width: edgeSize + padding, height: h * 0.5 };
      case "right":
        return { x: w - edgeSize - padding, y: h * 0.25, width: edgeSize + padding, height: h * 0.5 };
      default:
        return { x: 0, y: 0, width: 100, height: 100 };
    }
  }

  return {
    x: (region.x ?? 0) - padding,
    y: (region.y ?? 0) - padding,
    width: (region.width ?? 100) + padding * 2,
    height: (region.height ?? 100) + padding * 2,
  };
}

// ============================================================================
// Components
// ============================================================================

function SpotlightOverlay({ bounds, isCenter }) {
  if (isCenter) {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          style={{
            background: "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.85) 70%)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 backdrop-blur-sm" />
      <div
        className="absolute transition-all duration-500 ease-out rounded-2xl"
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.80)",
        }}
      />
      <div
        className="absolute transition-all duration-500 ease-out rounded-2xl border-2 border-white/30"
        style={{
          left: bounds.x - 2,
          top: bounds.y - 2,
          width: bounds.width + 4,
          height: bounds.height + 4,
        }}
      >
        <div className="absolute inset-0 rounded-2xl border-2 border-white/20 animate-ping opacity-50" style={{ animationDuration: '2s' }} />
      </div>
    </div>
  );
}

function Tooltip({ step, bounds, currentIndex, totalSteps, onNext, onSkip, onPrev }) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const isCenter = step.region.type === "center";

  let tooltipStyle = {};
  let arrowClass = "";

  if (isCenter) {
    tooltipStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else {
    const gap = 20;
    switch (step.tooltipPosition) {
      case "top":
        tooltipStyle = {
          left: bounds.x + bounds.width / 2,
          top: bounds.y - gap,
          transform: "translate(-50%, -100%)",
        };
        arrowClass = "after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-white/10";
        break;
      case "bottom":
        tooltipStyle = {
          left: bounds.x + bounds.width / 2,
          top: bounds.y + bounds.height + gap,
          transform: "translate(-50%, 0)",
        };
        arrowClass = "after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-b-white/10";
        break;
      case "left":
        tooltipStyle = {
          left: bounds.x - gap,
          top: bounds.y + bounds.height / 2,
          transform: "translate(-100%, -50%)",
        };
        arrowClass = "after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-l-white/10";
        break;
      case "right":
        tooltipStyle = {
          left: bounds.x + bounds.width + gap,
          top: bounds.y + bounds.height / 2,
          transform: "translate(0, -50%)",
        };
        arrowClass = "after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-r-white/10";
        break;
    }
  }

  return (
    <div
      className={cn(
        "fixed z-50 w-80 p-5 rounded-2xl",
        "bg-gradient-to-br from-white/10 to-white/5",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
        arrowClass
      )}
      style={tooltipStyle}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentIndex
                  ? "bg-white w-6"
                  : i < currentIndex
                    ? "bg-white/50"
                    : "bg-white/20"
              )}
            />
          ))}
        </div>
        <span className="text-[10px] text-white/40 font-mono">
          {currentIndex + 1}/{totalSteps}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {step.title}
      </h3>
      <p className="text-sm text-white/70 leading-relaxed">
        {step.description}
      </p>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10">
        <button
          onClick={onSkip}
          className="text-[11px] text-white/40 hover:text-white/60 transition-colors"
        >
          Skip tour
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 rounded-lg text-[11px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[11px] font-medium transition-all",
              "bg-white/20 hover:bg-white/30 text-white",
              "border border-white/10"
            )}
          >
            {step.actionText ?? (isLast ? "Finish" : "Next")}
          </button>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-white/30 text-center">
        Press <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">→</kbd> for next,
        <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono ml-1">Esc</kbd> to skip
      </div>
    </div>
  );
}

// ============================================================================
// Main Tour Component
// ============================================================================

function OnboardingTour({ steps = VISUALIZER_TOUR_STEPS, onComplete, onSkip, storageKey = "audio-canvas-tour-complete" }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 100, height: 100 });

  const step = steps[currentStep];

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  useEffect(() => {
    if (step) {
      setBounds(getRegionBounds(step.region));
      if (step.triggerVisibility) {
        step.triggerVisibility();
      }
    }
  }, [step]);

  useEffect(() => {
    const handleResize = () => {
      if (step) {
        setBounds(getRegionBounds(step.region));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible) return;

      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          handleNext();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "Escape":
          handleSkip();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      localStorage.setItem(storageKey, "true");
      setIsVisible(false);
      onComplete();
    }
  }, [currentStep, steps.length, onComplete, storageKey]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
    onSkip();
  }, [onSkip, storageKey]);

  if (!isVisible || !step) return null;

  const isCenter = step.region.type === "center";

  return (
    <div className="fixed inset-0 z-[100]">
      <SpotlightOverlay bounds={bounds} isCenter={isCenter} />

      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          const rect = { left: bounds.x, top: bounds.y, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height };
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            e.stopPropagation();
          }
        }}
      />

      <Tooltip
        step={step}
        bounds={bounds}
        currentIndex={currentStep}
        totalSteps={steps.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </div>
  );
}

// ============================================================================
// Hook to control tour
// ============================================================================

export function useTour(storageKey = "audio-canvas-tour-complete") {
  const [showTour, setShowTour] = useState(false);

  const startTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setShowTour(true);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const isTourComplete = useCallback(() => {
    return localStorage.getItem(storageKey) === "true";
  }, [storageKey]);

  return { showTour, setShowTour, startTour, resetTour, isTourComplete };
}

export default OnboardingTour;
