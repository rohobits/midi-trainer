# Research: tooling for a premium Canvas 2D game UI

Compiled 2026-09-25. Sizes are min+gzip measured from npm tarballs where noted.

## Verdicts

| Need | Choice | Size | Why |
|---|---|---|---|
| Easing | `bezier-easing` 3.1 | 0.8 kB | CSS-identical curves for canvas tweens |
| Springs | hand-rolled critically damped spring | ~12 lines | `motion`'s spring is 2 kB but pulls DOM code for anything else |
| SFX | `zzfx` 1.3 (ZzFXMicro) | 0.9 kB | sounds as number arrays, pre-rendered to buffers, no assets |
| Icons | `lucide` per-icon ESM | ~200 B each | tree-shakes to what is imported |
| Fonts | `@fontsource-variable/*` | ~150–250 kB woff2 total | offline PWA; Google Fonts CSS is not |
| Renderer | Canvas 2D, opaque, `desynchronized` | 0 | Pixi v8 is 233 kB gz and replaces rather than augments |
| Particles | hand-rolled pooled arrays + sprite atlas | ~100 lines | tsParticles is 23 kB and DOM-oriented |
| Toast / dialog | Popover API, `<dialog>` | 0 | Baseline since 2025 |
| Route transitions | `document.startViewTransition` | 0 | feature-detected |

Skipped: PixiJS, regl, OGL, twgl (only if a GPU bloom is ever wanted: one fullscreen quad
shader is ~2 kB), tsParticles, anime.js (12.7 kB tree-shaken), GSAP (free since 2025 but
DOM-centric, 25 kB), popmotion (unmaintained), wobble (2018), countup.js (hand-roll).

## Canvas techniques

- Live `ctx.shadowBlur` re-rasterises a blur per draw and halves frame rate; pre-render each
  colour/size glow once to an OffscreenCanvas and `drawImage` it in a `lighter` pass.
- `ctx.filter = 'blur()'` is not Baseline (Safari) and is CPU bound; avoid per frame.
- `getContext('2d', { alpha: false, desynchronized: true })` for the opaque highway.
- Trails: per-object last-N positions drawn at decreasing alpha in the additive pass.
- Screen shake: trauma 0..1, shake = trauma², offset = shake × max × noise, decay per frame,
  applied with `ctx.translate`, never on the DOM.
- `roundRect` and `createConicGradient` are Baseline.

## CSS

oklch and color-mix for lane palettes; `@property` for animated conic gradients; View
Transitions for same-document route swaps (Chrome 111, Safari 18, Firefox 144); container
queries for HUD panels; backdrop-filter costs ~3.5 ms per frame on a mid phone and re-renders
when content moves behind it, so never over the live canvas; grain as a fixed feTurbulence
data-URI at 4–8% overlay, never animated.

## Fonts (Google Fonts, variable, OFL)

Big Shoulders (wght 100–900, opsz 10–72; Display and Text merged Feb 2025) for display;
Instrument Sans (wght 400–700, wdth 75–100) for UI; JetBrains Mono (wght 100–800) for
numerics. Alternatives checked: Bricolage Grotesque, Unbounded, Geist, Archivo, Space Grotesk,
Sora. Barlow Condensed and Archivo Black are static.

## Open-source references

Rhythm Plus (Vue + Canvas 2D VSRG), Bemuse (React + Pixi), Sightread (piano falling notes,
TS + Vite), Guitar-Zero (vanilla TS + Vite + Canvas 2D highway), GuitarHeroJS (three.js
perspective). Kenney UI Pack and Input Prompts are CC0.

## Agent skills evaluated

Anthropic `frontend-design` (design plan, names the AI-look clichés), `pbakaus/impeccable`
(polish/critique/audit with detector rules), `ibelick/ui-skills` (baseline-ui, motion
performance, accessibility). Their guidance is applied directly here; none is installed as a
dependency of the repo.

## Visual regression for canvas

Test mode `?test=1&seed=42&t=<beats>` seeds the PRNG, pins the clock, renders one frame and
sets `window.__frameReady`; `page.clock.setFixedTime`, `emulateMedia({ reducedMotion })`,
`toHaveScreenshot` with `maxDiffPixelRatio 0.01`; baselines generated in CI's Playwright
image. Pixel assertions via `getImageData` for lane colours are cheaper and non-flaky.
