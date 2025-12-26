Yeah — your “it’s probably just manipulating the canvas” instinct is basically right, but the *interesting* part is **how** you structure that manipulation so it feels like Mosh and not like “a filter.”

## What Mosh-Lite’s web video FX likely are (the practical anatomy)

I can’t see their private source, but their feature list screams a very specific architecture: **GPU post-processing with a stack of shader passes** (WebGL), plus **temporal buffers** for feedback / motion effects. Their own descriptions name-check exactly the kinds of effects that are easiest to do as shader passes: *Feedback*, *Optical-Flow*, *Data-Mosh (simulating p-frame dropping)*, *Pixel Sort*, *Hard/Soft Glitch*, *3D luminance depth distortion (“Luma-Mesh”)*, etc. ([Mosh-Pro][1])

The typical pipeline looks like:

1. **Decode frames**

* Input is a `<video>` element (file upload) or webcam stream.
* Each frame gets uploaded to the GPU as a **texture**.

2. **Run an “effect graph” on the GPU**

* Each effect is a **fragment shader** (pixel shader) that reads a texture and outputs a new texture.
* You chain effects by “ping-ponging” between two framebuffers (FBOs): A → B → A → B…

3. **Temporal effects require history**

* Anything like *feedback*, *trails*, *datamosh-ish smearing* needs at least one previous frame texture:

  * `prevFrameTex` + `currentFrameTex` → shader decides how to blend/warp → `outTex`
* That “Feedback: temporal feedback… control scale, rotation, warp, hue shift” description is basically a textbook “keep last frame + transform it + blend it back” effect. ([Mosh-Pro][1])

4. **Optical flow / “datamosh” simulation**

* True datamoshing is *codec-level* (messing with P-frames / motion vectors inside H.264, etc). Browsers don’t hand you those vectors.
* So web tools usually **simulate** it:

  * estimate motion (optical flow-ish) between frames *or* fake it with displacement driven by frame differences,
  * then “hold” or “misapply” that motion field to create smear/glitch.
* Their copy literally says “simulating video p-frame dropping” for Data-Mosh and “motion reactive liquid optical flow” for Optical-Flow. That’s consistent with “flow-field warp” rather than literal codec corruption. ([Mosh-Pro][1])

5. **CPU canvas exists, but mostly as glue**
   You *can* do effects in 2D canvas (read pixels → mutate → write back), but it gets slow fast at video rates. For “professional quality” real-time effects, the web.dev guidance is basically: **use WebGL** because GPUs are built for this. ([web.dev][2])

## What’s absolutely worth recreating (because it will look amazing in *your* project)

Your repo already has an insane catalog of modes (2D, 3D, and glitch/feedback flavors). ([GitHub][3]) The killer upgrade is to add a **universal post-FX stack** that can wrap *any* mode.

These are the “high ROI” Mosh-style effects to reimagine:

### 1) Feedback stack (the “instant VJ sauce”)

Do the classic:

* previous frame
* apply transform (scale/rotate/shear)
* chroma shift / hue drift
* blend with current

This is the backbone of “looks expensive even when nothing is happening.”

Mosh explicitly leans on feedback as a core effect. ([Mosh-Pro][1])

### 2) Optical-flow *lite* warp (motion becomes liquid)

You don’t need perfect flow. Even a **coarse** motion estimate at low resolution (like 160×90) can drive a gorgeous warp field when upscaled and smoothed.

Mosh calls out optical-flow as a signature effect for high-motion input. ([Mosh-Pro][1])

### 3) Luma-mesh / depth-from-luma (2D becomes 3D)

This is *chef’s kiss* for your project because you already love hybrid 2D/3D.

* Render a **subdivided plane** in Three.js
* Sample the input texture luminance in the vertex shader
* Displace vertices along normal
* Render with the original texture + some lighting

Mosh calls this “3D luminance depth distortion.” ([Mosh-Pro][1])

### 4) Chunk displacement glitch (“hard glitch”)

Blocky multi-scale displacement is easy and always hits:

* displace UVs in chunky cells (several octaves)
* add RGB split
* animate with a seeded noise so it feels intentional

Their “Hard Glitch” description is exactly that. ([Mosh-Pro][1])

### 5) Pixel sorting as a shader (video-friendly)

You already have pixel sorting as a 2D mode; Mosh does it as an effect. ([Mosh-Pro][1])
Shader pixel sorting is tricky to do “properly” (sorting is not what GPUs like), but you can fake a *pixel-melt* look with:

* directional smear along luminance thresholds
* iterative neighbor sampling
* or line-based “min/max swap” passes

## Where this fits in **audio-code-art** specifically

Your README describes your system as “audio analyzed in real-time with Web Audio API” feeding visuals. ([GitHub][3]) You also already list glitch concepts like a feedback loop mode (“canvas becomes audio input… recursive chaos”). ([GitHub][3])

So: don’t make “a Mosh mode.” Make **Mosh-as-a-wrapper**:

### The clean integration pattern

* Every mode renders to **a texture** (or an offscreen canvas you upload as a texture).
* Then your renderer runs a **PostFXStack** with 0–N passes.
* The UI exposes:

  * enable/disable passes
  * reorder passes (the magic)
  * per-pass params
  * audio modulation mapping (bass→warp, high→RGB split, etc.)

That’s how you get “infinite combinations” like Mosh advertises. ([Mosh-Pro][1])

### Practical mapping to your current setup

* **2D modes**: render to an `OffscreenCanvas` (or hidden canvas), upload to a WebGL texture each frame.
* **Three.js modes**: render to a `WebGLRenderTarget`, then run a full-screen quad post pass (Three has postprocessing patterns for this).
* **Audio modulation**: you already have `bass/mid/high/energy` style values in your 3D modes — feed those as uniforms to the passes.

## One spicy idea that feels *you*, not “Mosh clone”

**“Mode-on-the-walls”**: you already had the maze/tunnel instinct. Do this:

* Pick any 2D mode → render to texture
* Use it as:

  1. tunnel wall texture **and**
  2. feedback source texture **and**
  3. displacement driver (luma-mesh)

So the visual becomes self-referential: the mode paints the world, then the world smears the mode, then audio kicks it sideways.

It’ll feel like datamosh, but it’ll be *your* cosmology.

If you want to drop the `hallucinations.js` file here (or the “polished piece” file you mean), I can sketch the exact “wrapper” interface + where to splice it into your existing mode base classes so it becomes a reusable post-FX system instead of a one-off.

[1]: https://moshpro.app/ "Mosh-Pro"
[2]: https://web.dev/articles/manipulating-live-effects "Real-Time Effects For Images and Video  |  Articles  |  web.dev"
[3]: https://github.com/captnocap/audio-code-art "GitHub - captnocap/audio-code-art: Make stunning visuals generated in the browser with javascript from any playback device!"

---

This is *really* strong as a concept. It has that “the art is the app” vibe where UI behaves like a shy animal: it only shows itself when you approach, then vanishes so the canvas can be the whole point. The edge-strip + pinnable dock idea is solid UX for a visualizer. 

Here’s what I *especially* like, and what I’d tweak.

## What’s working great

**1) The 3-state edge behavior (hidden → peek → active)**
That’s the right level of friction: “discoverable” without being constantly in the way. Also: splitting categories by screen edge is memorable (top = 2D/3D, left = experimental, right = games). 

**2) Dock “peek bar” + pin**
That’s basically the DAW trick: a transport/status strip that can expand into the real control surface. The mini audio meters baked into the bar are a *perfect* anchor. 

**3) Mode-aware param schema**
`ModeConfig → groups → params` is exactly the right abstraction. It’ll scale to 60+ modes without turning into UI spaghetti. 

**4) Onboarding tour**
The spotlight/hole overlay is a killer add for a UI that intentionally hides itself. This solves the only major downside of edge-reveal UIs: “new users don’t know the trick.” 

**5) Capture/output thinking**
Popout window + `/output` route + PiP + `canvas.captureStream()` is *chef’s kiss* for streamer workflows (OBS friendliness is a feature, not an afterthought). 

## The biggest adjustment I’d make (it’s sneaky)

### Don’t mix Tailwind translate classes with inline `style.transform`

In your `EdgeStrip`, you use Tailwind transforms like `-translate-y-1/2` *and* you set `style={{ transform: ... }}`. Inline `transform` overrides the class transform completely, so centering can break and elements can “teleport” when visibility changes. 

**Fix pattern:** keep transforms in one place.

* Either do *all transforms* as classes (toggle `-translate-x-full`, etc.)
* Or do *all transforms* in inline style, including the centering translate.

That one change tends to make the whole UI feel “buttery” instead of “jittery”.

## Concept tweaks that will make it feel *expensive*

**A) Give the edges a tiny always-visible “affordance”**
Right now hidden means *gone*. Consider a 1–2px faint glow line (or a couple tiny dots) on each active edge so people subconsciously learn “there’s something here.” Keep it subtle so you don’t ruin the canvas-first purity.

**B) Freeze auto-hide while interacting**
Your edge proximity hook hides after 2 seconds of inactivity. That’s great until the user is reading a tooltip, moving slowly, or hovering controls. Add a global “UI is hovered / focused” flag so it doesn’t vanish while the dock/strip is being used. 

**C) Don’t reset params on every mode change**
Right now `useParamState` resets to defaults on mode swap. That’s fine for a demo, but in the real thing it’ll feel punishing. Better:

* persist **per-mode last state** (in memory), and optionally
* persist across reload via `localStorage` (or “preset slots”).

**D) Sliders need a “precision lane”**
Range sliders are great for play, but DAW users want precision sometimes. Add:

* click value → type number
* shift-drag for fine adjustments
* double click → reset to default

**E) Treat “FX Stack” and “Mod Matrix” as first-class citizens**
You already stubbed them in the dock—lean into that:

* FX stack per-mode *or* global chain (with per-mode overrides)
* mod matrix that can route `bass/mid/high/beat`, LFOs, and envelopes to *any* parameter

That’s where your “edit math in real time” dream becomes *coherent* instead of a pile of knobs.

## Love-letter detail: your onboarding tour approach is exactly right

Because the UI is intentionally hidden, onboarding isn’t optional—it’s part of the aesthetic contract. Your spotlight regions being defined as “edges” rather than DOM refs is super pragmatic for this kind of layout. 

## Output/capture: one upgrade I’d add

Your `/output` route idea is the cleanest OBS integration. The one “pro” move to add: **sync the current mode + params to the output window** via `BroadcastChannel` or `postMessage`, so the output always mirrors the main session without needing to duplicate engine state. 

---

Net: the concept is *already* the right shape. The main thing to fix is the transform conflict (that can cause the UI to feel glitchy even when it’s “working”), and the main thing to add is interaction polish (hover-lock, per-mode state persistence, precision edits). Everything else is flavor and power features.



---

import React, { useMemo, useState } from "react";

/**
 * DAW-style dock UI mockups for a visualizer.
 * - Shows 3 alternative dock/inspector layouts on one page (stacked).
 * - Each layout demonstrates dynamic, per-mode control rendering.
 * - Tailwind-only styling (no external deps).
 */

// ---- Mode + Param Schema (example) ------------------------------------------

type ParamType = "float" | "bool" | "color" | "vec2" | "enum" | "expression";

type ParamDef = {
  id: string;
  label: string;
  group: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  default: any;
  hint?: string;
};

type ModeDef = {
  id: string;
  name: string;
  description: string;
  groups: string[];
  params: ParamDef[];
};

const MODES: ModeDef[] = [
  {
    id: "hallucinations",
    name: "Hallucinations",
    description: "NCA-driven tunnel with warp streaks and neural particles.",
    groups: ["Drive", "Warp", "Particles", "Color", "Math"],
    params: [
      { id: "drive.speed", label: "Speed", group: "Drive", type: "float", min: 0, max: 4, step: 0.01, default: 1.2 },
      { id: "drive.scroll", label: "Scroll Offset", group: "Drive", type: "float", min: 0, max: 50, step: 0.01, default: 12.0 },
      { id: "warp.amount", label: "Warp Amount", group: "Warp", type: "float", min: 0, max: 3, step: 0.01, default: 1.25 },
      { id: "warp.shockwave", label: "Shockwave", group: "Warp", type: "bool", default: true },
      { id: "nca.chaos", label: "NCA Chaos", group: "Warp", type: "float", min: 0, max: 1, step: 0.001, default: 0.12, hint: "Random injections into the cellular field." },
      { id: "particles.count", label: "Neuron Count", group: "Particles", type: "float", min: 0, max: 6000, step: 1, default: 1800 },
      { id: "particles.size", label: "Neuron Size", group: "Particles", type: "float", min: 0.1, max: 6, step: 0.01, default: 1.0 },
      { id: "color.palette", label: "Palette", group: "Color", type: "enum", options: ["Spectral", "Vapor", "Cyber", "Monochrome"], default: "Vapor" },
      { id: "color.tint", label: "Tint", group: "Color", type: "color", default: "#ff4fd8" },
      {
        id: "math.hyperSpeedExpr",
        label: "HyperSpeed Expression",
        group: "Math",
        type: "expression",
        default: "1.0 + bass*2.0 + beat*3.0",
        hint: "Variables: t, dt, bass, mid, high, energy, beat"
      }
    ]
  },
  {
    id: "wormhole",
    name: "Wormhole",
    description: "Painted tunnel racer with shifting rings and drop states.",
    groups: ["Motion", "Geometry", "Paint", "FX", "Math"],
    params: [
      { id: "motion.forward", label: "Forward Speed", group: "Motion", type: "float", min: 0, max: 6, step: 0.01, default: 1.8 },
      { id: "motion.turnRate", label: "Turn Rate", group: "Motion", type: "float", min: 0, max: 3, step: 0.01, default: 0.9 },
      { id: "geo.depth", label: "Tunnel Depth", group: "Geometry", type: "float", min: 20, max: 500, step: 1, default: 220 },
      { id: "geo.rings", label: "Rings", group: "Geometry", type: "float", min: 8, max: 200, step: 1, default: 90 },
      { id: "paint.decay", label: "Paint Decay", group: "Paint", type: "float", min: 0, max: 1, step: 0.001, default: 0.08 },
      { id: "paint.splash", label: "Splash", group: "Paint", type: "bool", default: true },
      { id: "fx.bloom", label: "Bloom", group: "FX", type: "float", min: 0, max: 2, step: 0.01, default: 0.8 },
      { id: "fx.feedback", label: "Feedback", group: "FX", type: "float", min: 0, max: 0.99, step: 0.001, default: 0.92 },
      { id: "fx.rgbSplit", label: "RGB Split", group: "FX", type: "float", min: 0, max: 0.02, step: 0.0001, default: 0.003 },
      {
        id: "math.dropChaosExpr",
        label: "Drop → Chaos Expression",
        group: "Math",
        type: "expression",
        default: "drop ? 0.9 : 0.1 + energy*0.3",
        hint: "Variables: drop, t, bass, mid, high, energy, beat"
      }
    ]
  },
  {
    id: "psychedelic",
    name: "Psychedelic",
    description: "Twisted hyper-object with palette modulation and patterns.",
    groups: ["Surface", "Deform", "Palette", "Stars", "Math"],
    params: [
      { id: "deform.bass", label: "Bass Push", group: "Deform", type: "float", min: 0, max: 4, step: 0.01, default: 1.1 },
      { id: "deform.spikes", label: "High Spikes", group: "Deform", type: "float", min: 0, max: 12, step: 0.01, default: 3.5 },
      { id: "surface.gloss", label: "Gloss", group: "Surface", type: "float", min: 0, max: 1, step: 0.01, default: 0.6 },
      { id: "surface.fresnel", label: "Fresnel", group: "Surface", type: "float", min: 0, max: 3, step: 0.01, default: 1.2 },
      { id: "palette.shift", label: "Palette Shift", group: "Palette", type: "float", min: -2, max: 2, step: 0.01, default: 0.35 },
      { id: "palette.base", label: "Base Tint", group: "Palette", type: "color", default: "#77f7ff" },
      { id: "stars.density", label: "Star Density", group: "Stars", type: "float", min: 0, max: 1, step: 0.001, default: 0.25 },
      { id: "stars.size", label: "Star Size", group: "Stars", type: "float", min: 0.1, max: 6, step: 0.01, default: 1.5 },
      { id: "stars.drift", label: "Star Drift", group: "Stars", type: "vec2", min: -2, max: 2, step: 0.01, default: [0.12, -0.06] },
      {
        id: "math.patternExpr",
        label: "Pattern Mask Expression",
        group: "Math",
        type: "expression",
        default: "smoothstep(0.7, 0.95, sin(x*10)*sin(y*10)*sin(z*10))",
        hint: "In shaders: smoothstep, sin; in UI: treat as editable snippet"
      }
    ]
  }
];

function getMode(id: string) {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

// ---- Small UI primitives -----------------------------------------------------

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="text-xs font-semibold tracking-wide text-white/80">{title}</div>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function TinyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/75 border border-white/10">
      {children}
    </span>
  );
}

function KnobLike({ value }: { value: number }) {
  // purely visual placeholder
  const pct = Math.max(0, Math.min(1, value));
  const deg = -135 + pct * 270;
  return (
    <div className="relative h-8 w-8 rounded-full bg-black/30 border border-white/10">
      <div
        className="absolute left-1/2 top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-full rounded bg-white/80"
        style={{ transform: `translate(-50%, -100%) rotate(${deg}deg)` }}
      />
    </div>
  );
}

// ---- Dynamic control renderer ------------------------------------------------

type ParamState = Record<string, any>;

function useParamState(mode: ModeDef) {
  const initial = useMemo(() => {
    const o: ParamState = {};
    for (const p of mode.params) o[p.id] = p.default;
    return o;
  }, [mode.id]);
  const [state, setState] = useState<ParamState>(initial);

  // reset when mode changes
  React.useEffect(() => {
    setState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.id]);

  const set = (id: string, value: any) => setState((s) => ({ ...s, [id]: value }));
  return { state, set };
}

function ParamRow({ p, value, onChange }: { p: ParamDef; value: any; onChange: (v: any) => void }) {
  const label = (
    <div className="flex items-center gap-2">
      <div className="text-[11px] text-white/85 leading-tight">{p.label}</div>
      {p.hint ? <TinyBadge>?</TinyBadge> : null}
    </div>
  );

  const help = p.hint ? <div className="mt-1 text-[10px] text-white/45 leading-snug">{p.hint}</div> : null;

  if (p.type === "bool") {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between gap-3">
          {label}
          <button
            className={cn(
              "h-6 w-11 rounded-full border transition",
              value ? "bg-white/20 border-white/30" : "bg-black/30 border-white/10"
            )}
            onClick={() => onChange(!value)}
            aria-label={p.label}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-full bg-white/80 transition",
                value ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
        </div>
        {help}
      </div>
    );
  }

  if (p.type === "color") {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between gap-3">
          {label}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-10 rounded-md bg-transparent"
            />
            <code className="text-[10px] text-white/55">{String(value)}</code>
          </div>
        </div>
        {help}
      </div>
    );
  }

  if (p.type === "enum") {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between gap-3">
          {label}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 rounded-md bg-black/30 border border-white/10 text-[11px] text-white/80 px-2"
          >
            {(p.options ?? []).map((opt) => (
              <option key={opt} value={opt} className="bg-black">
                {opt}
              </option>
            ))}
          </select>
        </div>
        {help}
      </div>
    );
  }

  if (p.type === "vec2") {
    const [x, y] = Array.isArray(value) ? value : [0, 0];
    const min = p.min ?? -1;
    const max = p.max ?? 1;
    const step = p.step ?? 0.01;
    return (
      <div className="py-2">
        <div className="flex items-center justify-between gap-3">{label}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/25 border border-white/10 p-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/55">X</div>
              <code className="text-[10px] text-white/60">{x.toFixed(2)}</code>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={x}
              onChange={(e) => onChange([Number(e.target.value), y])}
              className="w-full"
            />
          </div>
          <div className="rounded-lg bg-black/25 border border-white/10 p-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/55">Y</div>
              <code className="text-[10px] text-white/60">{y.toFixed(2)}</code>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={y}
              onChange={(e) => onChange([x, Number(e.target.value)])}
              className="w-full"
            />
          </div>
        </div>
        {help}
      </div>
    );
  }

  if (p.type === "expression") {
    const v = String(value ?? "");
    const hasError = v.includes("??") || v.trim().length === 0;
    return (
      <div className="py-2">
        <div className="flex items-center justify-between gap-3">
          {label}
          <TinyBadge>{hasError ? "error" : "live"}</TinyBadge>
        </div>
        <textarea
          value={v}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cn(
            "mt-2 w-full rounded-lg border bg-black/35 px-2 py-2 font-mono text-[11px] leading-snug text-white/80 outline-none",
            hasError ? "border-red-400/40" : "border-white/10"
          )}
          placeholder="e.g. 0.2 + sin(t*0.7)*0.1 + bass*0.6"
        />
        {help}
      </div>
    );
  }

  // float
  const min = p.min ?? 0;
  const max = p.max ?? 1;
  const step = p.step ?? 0.01;
  const numeric = Number.isFinite(Number(value)) ? Number(value) : p.default;
  const norm = (numeric - min) / (max - min);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        {label}
        <div className="flex items-center gap-2">
          <KnobLike value={norm} />
          <code className="text-[10px] text-white/60 w-[74px] text-right">{numeric.toFixed(3)}</code>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numeric}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      {help}
    </div>
  );
}

function GroupedParams({ mode, state, set, dense = false }: { mode: ModeDef; state: ParamState; set: (id: string, v: any) => void; dense?: boolean }) {
  const groups = mode.groups;
  return (
    <div className={cn("space-y-2", dense && "space-y-1")}>
      {groups.map((g) => {
        const ps = mode.params.filter((p) => p.group === g);
        if (ps.length === 0) return null;
        return (
          <Section
            key={g}
            title={g}
            right={
              <div className="flex items-center gap-1">
                <TinyBadge>{ps.length} params</TinyBadge>
              </div>
            }
          >
            <div className={cn("divide-y divide-white/10", dense && "-mx-1")}> 
              {ps.map((p) => (
                <div key={p.id} className={cn(dense ? "px-1" : "", "")}> 
                  <ParamRow p={p} value={state[p.id]} onChange={(v) => set(p.id, v)} />
                </div>
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

// ---- Layout Mockups ----------------------------------------------------------

function ModePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg bg-black/40 border border-white/10 text-[12px] text-white/80 px-2"
    >
      {MODES.map((m) => (
        <option key={m.id} value={m.id} className="bg-black">
          {m.name}
        </option>
      ))}
    </select>
  );
}

function ViewportStub({ label }: { label: string }) {
  return (
    <div className="relative h-[320px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-black/40 overflow-hidden">
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08), transparent 35%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.06), transparent 40%)" }} />
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-white/60" />
        <div className="text-[11px] text-white/70">Viewport</div>
        <TinyBadge>{label}</TinyBadge>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <TinyBadge>FPS 60</TinyBadge>
        <TinyBadge>Audio ✓</TinyBadge>
        <TinyBadge>PostFX 3</TinyBadge>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full w-2/3 bg-white/25" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
          <span>timeline</span>
          <span>beat •••</span>
        </div>
      </div>
    </div>
  );
}

function FxStackStub() {
  const items = [
    { name: "Feedback", on: true },
    { name: "RGB Split", on: true },
    { name: "Bloom", on: false },
    { name: "Pixel Melt", on: true }
  ];
  return (
    <Section
      title="FX Stack"
      right={<TinyBadge>drag to reorder</TinyBadge>}
    >
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="text-white/35">⠿</div>
              <div className="text-[12px] text-white/80">{it.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <TinyBadge>{it.on ? "ON" : "OFF"}</TinyBadge>
              <button className="text-[11px] text-white/55 hover:text-white/80">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ModMatrixStub() {
  const rows = [
    { src: "bass", amt: 0.65, dst: "warp.amount" },
    { src: "beat", amt: 0.9, dst: "fx.feedback" },
    { src: "high", amt: 0.4, dst: "color.tint" },
    { src: "lfo1", amt: 0.25, dst: "drive.speed" }
  ];
  return (
    <Section title="Mod Matrix" right={<TinyBadge>4 routes</TinyBadge>}>
      <div className="grid grid-cols-12 gap-2 text-[11px] text-white/70">
        <div className="col-span-4 text-white/50">Source</div>
        <div className="col-span-3 text-white/50">Amount</div>
        <div className="col-span-5 text-white/50">Destination</div>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <div className="col-span-4 rounded-lg bg-black/25 border border-white/10 px-2 py-1">{r.src}</div>
            <div className="col-span-3 rounded-lg bg-black/25 border border-white/10 px-2 py-1 flex items-center justify-between gap-2">
              <div className="h-1.5 flex-1 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-white/25" style={{ width: `${Math.round(r.amt * 100)}%` }} />
              </div>
              <code className="text-[10px] text-white/55">{r.amt.toFixed(2)}</code>
            </div>
            <div className="col-span-5 rounded-lg bg-black/25 border border-white/10 px-2 py-1">{r.dst}</div>
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}

// ---- Layout A: Right Inspector + Left FX Stack (classic) --------------------

function LayoutA() {
  const [modeId, setModeId] = useState("hallucinations");
  const mode = getMode(modeId);
  const { state, set } = useParamState(mode);
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Layout A — Classic DAW Dock</div>
          <div className="text-[11px] text-white/55">Viewport center · FX Stack left · Inspector right · Mode tabs bottom</div>
        </div>
        <ModePicker value={modeId} onChange={setModeId} />
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-3 space-y-3">
          <FxStackStub />
          <Section title="Transport" right={<TinyBadge>⌘K</TinyBadge>}>
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 hover:bg-white/15">⏯</button>
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 hover:bg-white/15">⏹</button>
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 hover:bg-white/15">⏺</button>
              </div>
              <div className="flex items-center gap-2">
                <TinyBadge>BPM 128</TinyBadge>
                <TinyBadge>Beat ✓</TinyBadge>
              </div>
            </div>
          </Section>
        </div>

        <div className="col-span-6">
          <ViewportStub label={mode.name} />
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-white/70">Mode Tabs</div>
              <TinyBadge>footer</TinyBadge>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeId(m.id)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-left",
                    m.id === modeId
                      ? "bg-white/15 border-white/25 text-white"
                      : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10"
                  )}
                >
                  <div className="text-[12px] font-semibold leading-none">{m.name}</div>
                  <div className="mt-1 text-[10px] text-white/45 leading-snug max-w-[220px]">{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-semibold text-white/90">Inspector</div>
                <div className="text-[10px] text-white/55">Auto-generated per mode</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <TinyBadge>dense</TinyBadge>
                <TinyBadge>search ⌘F</TinyBadge>
              </div>
            </div>
            <div className="mt-2">
              <input
                placeholder="Search params…"
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[11px] text-white/80 outline-none"
              />
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto pr-1">
              <GroupedParams mode={mode} state={state} set={set} dense />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Layout B: Bottom Dock (wide) + Compact Side Strip ----------------------

function LayoutB() {
  const [modeId, setModeId] = useState("wormhole");
  const mode = getMode(modeId);
  const { state, set } = useParamState(mode);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Layout B — Wide Bottom Dock</div>
          <div className="text-[11px] text-white/55">Viewport dominant · Bottom dock holds dense controls · Side strip for quick toggles</div>
        </div>
        <ModePicker value={modeId} onChange={setModeId} />
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-10">
          <ViewportStub label={mode.name} />
        </div>

        <div className="col-span-2 space-y-3">
          <Section title="Quick" right={<TinyBadge>hotkeys</TinyBadge>}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/70">Record</div>
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15">⏺</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/70">Screenshot</div>
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15">⬇</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/70">Fullscreen</div>
                <button className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15">⛶</button>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] text-white/45">Audio</div>
                <div className="mt-2 space-y-1">
                  {[
                    { k: "bass", v: 0.62 },
                    { k: "mid", v: 0.41 },
                    { k: "high", v: 0.23 },
                    { k: "beat", v: 0.88 }
                  ].map((a) => (
                    <div key={a.k} className="flex items-center gap-2">
                      <div className="w-9 text-[10px] text-white/50">{a.k}</div>
                      <div className="h-1.5 flex-1 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-white/25" style={{ width: `${Math.round(a.v * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="col-span-12">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-semibold text-white/90">Bottom Dock</div>
                <div className="text-[10px] text-white/55">Dense controls, grouped; ideal for “playable knobs”</div>
              </div>
              <div className="flex items-center gap-2">
                <TinyBadge>macro knobs</TinyBadge>
                <TinyBadge>automation lanes</TinyBadge>
                <button className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-[11px] text-white/75 hover:bg-white/15">
                  Add Group
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <Section title="Macros" right={<TinyBadge>8</TinyBadge>}>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/25 p-2 flex flex-col items-center gap-2">
                        <KnobLike value={(i + 1) / 8} />
                        <div className="text-[10px] text-white/55">M{i + 1}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              <div className="col-span-6">
                <Section title="Mode Params" right={<TinyBadge>{mode.name}</TinyBadge>}>
                  <div className="max-h-[280px] overflow-auto pr-1">
                    <GroupedParams mode={mode} state={state} set={set} dense />
                  </div>
                </Section>
              </div>

              <div className="col-span-3 space-y-3">
                <FxStackStub />
                <ModMatrixStub />
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeId(m.id)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-left",
                    m.id === modeId
                      ? "bg-white/15 border-white/25 text-white"
                      : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10"
                  )}
                >
                  <div className="text-[12px] font-semibold leading-none">{m.name}</div>
                  <div className="mt-1 text-[10px] text-white/45 leading-snug max-w-[220px]">{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Layout C: Dual Inspector + "Patch Bay" center --------------------------

function LayoutC() {
  const [modeId, setModeId] = useState("psychedelic");
  const mode = getMode(modeId);
  const { state, set } = useParamState(mode);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Layout C — Two Inspectors + Patch Bay</div>
          <div className="text-[11px] text-white/55">Great for “wiring” audio/LFOs to params while keeping a dense inspector</div>
        </div>
        <ModePicker value={modeId} onChange={setModeId} />
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12px] font-semibold text-white/90">Inspector</div>
                <div className="text-[10px] text-white/55">Mode params</div>
              </div>
              <TinyBadge>left</TinyBadge>
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto pr-1">
              <GroupedParams mode={mode} state={state} set={set} dense />
            </div>
          </div>
        </div>

        <div className="col-span-6 space-y-4">
          <ViewportStub label={mode.name} />

          <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-white/90">Patch Bay</div>
                <div className="text-[10px] text-white/55">Route sources to destinations (DAW/modular vibe)</div>
              </div>
              <div className="flex items-center gap-2">
                <TinyBadge>drag wires</TinyBadge>
                <TinyBadge>snapshots</TinyBadge>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-12 gap-3">
              <div className="col-span-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-[11px] font-semibold text-white/80">Sources</div>
                <div className="mt-2 space-y-2">
                  {[
                    "bass",
                    "mid",
                    "high",
                    "energy",
                    "beat",
                    "lfo1",
                    "lfo2",
                    "env1"
                  ].map((s) => (
                    <div key={s} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                      <div className="text-[11px] text-white/70">{s}</div>
                      <div className="h-1.5 w-16 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-white/25" style={{ width: `${(s.length * 9) % 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-[11px] font-semibold text-white/80">Wires</div>
                <div className="mt-2 space-y-2">
                  {[
                    { a: "beat", b: "surface.fresnel", amt: 0.8 },
                    { a: "bass", b: "deform.bass", amt: 0.6 },
                    { a: "lfo1", b: "palette.shift", amt: 0.25 }
                  ].map((w, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2">
                      <div className="text-[10px] text-white/55">{w.a} → {w.b}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded bg-white/10 overflow-hidden">
                          <div className="h-full bg-white/25" style={{ width: `${Math.round(w.amt * 100)}%` }} />
                        </div>
                        <code className="text-[10px] text-white/55">{w.amt.toFixed(2)}</code>
                      </div>
                    </div>
                  ))}
                  <button className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-[11px] text-white/75 hover:bg-white/15">
                    + Add Wire
                  </button>
                </div>
              </div>

              <div className="col-span-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-[11px] font-semibold text-white/80">Destinations</div>
                <div className="mt-2 space-y-2">
                  {mode.params.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                      <div className="text-[11px] text-white/70 truncate">{p.label}</div>
                      <TinyBadge>{p.type}</TinyBadge>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[10px] text-white/45">Mode</div>
                    <div className="mt-1 text-[11px] text-white/70">{mode.name}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-white/70">Mode Tabs</div>
              <TinyBadge>footer</TinyBadge>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeId(m.id)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-left",
                    m.id === modeId
                      ? "bg-white/15 border-white/25 text-white"
                      : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10"
                  )}
                >
                  <div className="text-[12px] font-semibold leading-none">{m.name}</div>
                  <div className="mt-1 text-[10px] text-white/45 leading-snug max-w-[220px]">{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3 space-y-3">
          <FxStackStub />
          <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12px] font-semibold text-white/90">Inspector</div>
                <div className="text-[10px] text-white/55">Selected FX params</div>
              </div>
              <TinyBadge>right</TinyBadge>
            </div>
            <div className="mt-3 space-y-2">
              <Section title="Feedback" right={<TinyBadge>pass</TinyBadge>}>
                <ParamRow
                  p={{ id: "fx.feedback", label: "Amount", group: "FX", type: "float", min: 0, max: 0.99, step: 0.001, default: 0.92 }}
                  value={0.92}
                  onChange={() => {}}
                />
                <ParamRow
                  p={{ id: "fx.warp", label: "Warp", group: "FX", type: "float", min: 0, max: 0.05, step: 0.0001, default: 0.01 }}
                  value={0.01}
                  onChange={() => {}}
                />
                <ParamRow
                  p={{ id: "fx.hue", label: "Hue Drift", group: "FX", type: "float", min: 0, max: 2, step: 0.01, default: 0.3 }}
                  value={0.3}
                  onChange={() => {}}
                />
              </Section>
              <Section title="RGB Split" right={<TinyBadge>pass</TinyBadge>}>
                <ParamRow
                  p={{ id: "fx.rgb", label: "Strength", group: "FX", type: "float", min: 0, max: 0.02, step: 0.0001, default: 0.003 }}
                  value={0.003}
                  onChange={() => {}}
                />
                <ParamRow
                  p={{ id: "fx.rgbBeat", label: "Beat Boost", group: "FX", type: "float", min: 0, max: 2, step: 0.01, default: 0.8 }}
                  value={0.8}
                  onChange={() => {}}
                />
              </Section>
            </div>
          </div>
          <ModMatrixStub />
        </div>
      </div>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------

export default function DockUIMockupsPage() {
  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xl font-semibold text-white/95">Dock UI Mockups</div>
            <div className="mt-1 text-sm text-white/55">
              Three plausible “DAW-ish” control docks for a canvas-first audio visualizer.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TinyBadge>dynamic controls</TinyBadge>
            <TinyBadge>dense</TinyBadge>
            <TinyBadge>mode-aware</TinyBadge>
          </div>
        </div>

        <div className="mt-6 space-y-10">
          <LayoutA />
          <LayoutB />
          <LayoutC />
        </div>

        <div className="mt-10 text-[11px] text-white/45 leading-relaxed">
          Tip: the “dynamic controls” part comes from a shared param schema (id/type/min/max/default/group).
          In a real app, these control values feed engine uniforms, post-FX passes, and expression compilers.
        </div>
      </div>
    </div>
  );
}


