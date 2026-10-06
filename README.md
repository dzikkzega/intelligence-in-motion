# IN MOTION — Cinematic AI Study

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sebuah film motion graphics interaktif berdurasi 118 detik (01:58) yang dirender live 100% menggunakan kode di peramban (tanpa file video MP4/WebM/GIF). Menampilkan 4 ekosistem AI terdepan: **OpenAI Codex**, **Anthropic Claude**, **Google Gemini**, dan **xAI Grok**.

## Fitur Utama

- **Live Code Cinema**: Kamera one-take virtual berkelanjutan, transformasi geometri 3D, voxel morphology, procedural tube branching, faceted refraction prism, dan shader custom.
- **Soundtrack Prosedural**: Sintesis Web Audio API 118 detik stereo (ambient pad, bass pulses, sub hits, risers) sinkron dengan transformasi adegan dan jeda hening dramatis (Grok freeze di 94.5–96s, convergence di 103–104s).
- **Timeline & Chaptering**:
  1. `00:00 - 00:12` — Origin (Awakening & language blocks)
  2. `00:12 - 00:35` — Codex (Software city, logic gates, processor die)
  3. `00:35 - 00:58` — Claude (Manuscript rivers, knowledge tree, library slabs)
  4. `00:58 - 01:21` — Gemini (Multimodal waves, refraction prism, light beam)
  5. `01:21 - 01:43` — Grok (Monochrome data highway, steel towers, freeze)
  6. `01:43 - 01:58` — Convergence (Layered unified core, fade to darkness)
- **Kontrol & Aksesibilitas**:
  - Play, pause, scrub timeline, lompat babak.
  - Shortcut keyboard: `Space` (Play/Pause), `←`/`→` (Seek ±5s), `M` (Mute/Unmute), `R` (Replay).
  - Mode `prefers-reduced-motion` menampilkan tableau stasioner tiap babak tanpa kilatan cahaya.
  - Fallback otomatis ke canvas 2D bila WebGL2 tidak tersedia.

## Menjalankan Proyek

```bash
# Jalankan development server
npm run dev

# Jalankan linter
npm run lint

# Build untuk produksi
npm run build

# Menjalankan pengujian
node tests/choreography-check.mjs
node tests/audio-check.mjs
node tests/film-check.mjs
```

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE) © 2026 dzikkzega.
