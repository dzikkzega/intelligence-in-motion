# IN MOTION — A Cinematic Study of AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An interactive 118-second (01:58) motion graphics film rendered entirely in the browser with code—no MP4, WebM, or GIF assets. It explores four leading AI ecosystems: **OpenAI Codex**, **Anthropic Claude**, **Google Gemini**, and **xAI Grok**.

## Features

- **Live code cinema:** A continuous virtual one-take camera, transforming 3D geometry, voxel forms, procedural branching tubes, a faceted refractive prism, and custom shaders.
- **Procedural soundtrack:** 118 seconds of stereo Web Audio synthesis—ambient pads, bass pulses, sub hits, and risers—synchronized with scene transformations, including dramatic silence during the Grok freeze (94.5–96s) and convergence (103–104s).
- **Timeline and chapters:**
  1. `00:00 - 00:12` — Origin (awakening and language blocks)
  2. `00:12 - 00:35` — Codex (software city, logic gates, processor die)
  3. `00:35 - 00:58` — Claude (manuscript rivers, knowledge tree, library slabs)
  4. `00:58 - 01:21` — Gemini (multimodal waves and refractive prism)
  5. `01:21 - 01:43` — Grok (monochrome data highway, steel towers, freeze)
  6. `01:43 - 01:58` — Convergence (unified layered core, fade to darkness)
- **Controls and accessibility:**
  - Play, pause, scrub the timeline, and jump between chapters.
  - Keyboard shortcuts: `Space` (play/pause), `←`/`→` (seek ±5s), `M` (mute/unmute), `R` (replay).
  - `prefers-reduced-motion` displays a static tableau for each chapter without flashes.
  - Automatically falls back to a 2D canvas when WebGL2 is unavailable.

## Getting Started

```bash
# Start the development server
npm run dev

# Run the linter
npm run lint

# Create a production build
npm run build

# Run the checks
node tests/choreography-check.mjs
node tests/audio-check.mjs
node tests/film-check.mjs
```

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 dzikkzega.
