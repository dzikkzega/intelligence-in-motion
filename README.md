# IN MOTION — A Cinematic Study of AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg?logo=three.js&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)

A 118-second (01:58) cinematic motion graphics film rendered **100% in real-time in the browser**—zero video files (no MP4, WebM, GIF, or Lottie). It stages the evolution and aesthetic identity of four frontier AI ecosystems: **OpenAI Codex**, **Anthropic Claude**, **Google Gemini**, and **xAI Grok**.

---

## The Philosophy: Code as Film

Traditional web experiences embed pre-rendered video files for high-fidelity motion. **IN MOTION** proves modern browser primitives can render cinematic production values on the fly:

- **Zero video bandwidth:** The entire experience compiles to lightweight JS, GLSL shaders, and audio nodes.
- **Scrubbable & deterministic:** Jump to any millisecond; every camera position, particle coordinate, and geometric voxel resolves deterministically via absolute timeline sampling.
- **Zero-latency audio:** Built entirely on the Web Audio API with a live graph that responds instantly to play, pause, seek, and rate adjustments.

---

## Tech Stack & Architecture

| Layer | Technology | Role |
|---|---|---|
| **Rendering Engine** | **Three.js `0.186` + GLSL** | Custom studio shaders, instanced box morphology (1,536 instances), procedural tube knowledge trees, faceted refractive prisms, and UnrealBloom postprocessing. |
| **Choreography & Camera** | **Custom Hermite C1 Engine** | 44 spatial keyframe targets interpolated smoothly with continuous tangent vectors, roll management, and dynamic portrait aspect ratio compensation. |
| **Soundtrack & Scoring** | **Web Audio API** | Real-time electronic ambient synthesis—stereo binaural oscillators, resonant filters, feed-forward stereo reverb delays, sub-bass impacts, and cinematic silence gates. |
| **Timeline & Orchestration** | **GSAP 3.15 + Custom Clock** | Scrubbable timeline with millisecond-precision seeking, auto-advancing chapters, and playback controls. |
| **UI & Typography** | **React 19 + TypeScript** | Responsive overlay with Manrope, Bodoni Moda, and JetBrains Mono typography; zero layout shift; accessible interactive controls. |
| **Bundler & Tooling** | **Vite 8 + Oxlint** | Sub-second HMR, sub-400ms production builds with Rolldown tree-shaking, and 12-thread Oxlint validation. |
| **Verification Suite** | **Playwright + Node test runners** | Deterministic frame checks across 5 viewport ratios, audio latency assertions, and reduced-motion compliance tests. |

---

## Chapter Progression (118s)

```
00:00        00:12        00:35        00:58        01:21        01:43       01:58
  │ Origin     │ Codex      │ Claude     │ Gemini     │ Grok       │ Convergence │
  └────────────┴────────────┴────────────┴────────────┴────────────┴─────────────┘
```

1. **Origin (`00:00 - 00:12`):** Latent space awakening. Floating language blocks assemble into a cohesive machine sphere.
2. **Codex (`00:12 - 00:35`):** Structural logic. The sphere unfolds into a towering procedural software grid, forms the CODEX voxel architecture, and collapses into a microchip processor die.
3. **Claude (`00:35 - 00:58`):** Literary reasoning & safety. Warm paper landscapes, a 24-branch procedural knowledge tree, and library slab monoliths.
4. **Gemini (`00:58 - 01:21`):** Multimodal perception. Flowing sine waves, orbiting media slabs, and a faceted crystal refractive prism.
5. **Grok (`01:21 - 01:43`):** Raw acceleration & truth-seeking. High-speed monochrome data highway, dual steel data corridors, and a dramatic temporal freeze (`94.5s - 96s`).
6. **Convergence (`01:43 - 01:58`):** Four intelligences synthesize into a unified concentric sphere before a slow dissolve to darkness.

---

## Project Structure

```
intelligence-in-motion/
├── src/
│   ├── webgl/
│   │   ├── Environment.js       # Core Three.js scene, shaders, meshes, postprocessing
│   │   ├── choreography.js      # 44-frame spatial keyframes & Hermite C1 camera path
│   │   └── fallback.ts          # 2D Canvas fallback for devices without WebGL2
│   ├── audio/
│   │   └── soundtrack.ts        # Real-time procedural Web Audio synthesizer engine
│   ├── timeline/
│   │   ├── config.ts            # Master chapter marks, cue timings, duration (118s)
│   │   └── masterTimeline.ts    # Central play/pause/seek state management
│   ├── scenes/
│   │   └── Scenes.tsx           # Chapter captions and brand typography
│   ├── components/
│   │   └── TimelineControls.tsx # Scrub bar, keyboard shortcuts, chapter switcher
│   └── App.tsx                  # Root cinema container and audio unlock overlay
├── tests/
│   ├── choreography-check.mjs   # Mathematical continuity & boundary assertions
│   ├── audio-check.mjs          # Synthesizer graph & instant-entry verification
│   └── film-check.mjs           # Multi-viewport & determinism test suite
└── index.html                   # Entry point with preloaded typography
```

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm 9+

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/dzikkzega/intelligence-in-motion.git
cd intelligence-in-motion

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Visit `http://localhost:5173` and click **ENTER EXPERIENCE** to unlock browser audio.

---

## Commands & Quality Checks

```bash
# Fast linting with oxlint (0 warnings, 0 errors policy)
npm run lint

# Production build with TypeScript checking
npm run build

# Run verification test suite
node tests/choreography-check.mjs
node tests/audio-check.mjs
node tests/film-check.mjs
```

---

## Controls & Accessibility

- **Space:** Play / Pause
- **Left / Right Arrow:** Seek ±5 seconds
- **M:** Mute / Unmute audio
- **R:** Replay from start
- **Chapter Pills:** Instant jump to any narrative act
- **Reduced Motion:** Honors `prefers-reduced-motion` with stationary tableau shots per chapter—no rapid camera pans or flashes.

---

## Contributing & Future Experiments

Contributions and creative remixes are warmly welcome! Some ideas to explore:
- [ ] Add interactive camera orbit mode during pause
- [ ] Custom WebGL post-processing shaders (chromatic aberration, lens distortion, depth of field)
- [ ] Additional procedural sound layers (FM synthesis presets, generative lead arpeggios)
- [ ] WebGPU renderer backend

Feel free to open an Issue or submit a Pull Request.

---

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 dzikkzega.

