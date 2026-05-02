<div align="center">
  <img src="https://static-1317922524.cos.ap-guangzhou.myqcloud.com/static/icon.png" alt="Bulbul Logo" width="128" height="128">
</div>

# Bulbul - Rapid RAW Image Culling

[![Tauri](https://img.shields.io/badge/Tauri-2-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-Latest-CE422B?logo=rust)](https://www.rust-lang.org)

[中文文档](README.md)

A fast image culling app designed for bird photographers. Instant preview, rapid selection.

Shoot in bursts, cull with ease!

## Features

### Smart Grouping

- Automatically groups burst shots by capture time and compositional similarity
- Adjustable parameters: similarity threshold (50%–100%) and time interval (1–120 seconds)
- Auto-evaluates focus quality for each image (1–5 stars), helping you quickly find the sharpest shot

### Magnifier

- Press and drag on an image to bring up a local magnifier
- Check focus details without switching views
- Releases to dismiss — no interruption to your browsing flow

### Batch Export

- Click to select multiple images, then press `Ctrl+E` or click the export button
- Copies original RAW files to the target directory; duplicate filenames are auto-renamed

---

## Usage Guide

### Open a Folder

After launching the app, click the **Select Folder** button and choose a directory containing RAW files. The app will automatically scan, group, and display the results.

> Supported RAW formats and non-RAW image formats (subdirectories are not scanned):
>
> **RAW Formats**
>
> | Format | Vendor | Verified |
> | ------ | ------ | -------- |
> | NEF | Nikon | ✅ |
> | CR2 | Canon | ✅ |
> | CR3 | Canon | ✅ |
> | ARW | Sony | ✅ |
> | DNG | Adobe | ✅ |
> | RAF | Fujifilm | ✅ |
> | ORF | Olympus | ✅ |
> | RW2 | Panasonic | ✅ |
> | PEF | Pentax | - |
>
> **Non-RAW Formats**
>
> | Format | Notes |
> | ------ | ----- |
> | JPG / JPEG | EXIF parsing supported |
> | PNG | No EXIF support |
> | TIFF / TIF | EXIF parsing supported |
> | WebP | Best-effort EXIF parsing |

### Browsing & Selection

#### Mouse Controls

| Action | Effect |
| ------ | ------ |
| Scroll wheel | Zoom canvas |
| Click image | Select / deselect |
| Press & drag on image | Open magnifier |
| Hover image | Show subtle outline |

#### Bottom Filmstrip

The filmstrip at the bottom of the window shows a representative image and count for each group. Click to jump to that group. The filmstrip auto-scrolls when switching groups via keyboard.

#### Top Navigation Bar

| Area | Function |
| ---- | -------- |
| Left | Group navigation arrows + current group name |
| Center | Group progress (e.g. 3/15) + progress bar |
| Path | Abbreviated directory path; click to copy full path |
| Right | Detection toggle / Group params / Switch directory / Theme toggle / Export |

### Adjust Grouping Parameters

Click the **Group Parameters** button on the right side of the navigation bar to open the adjustment panel:

- **Similarity threshold** (50%–100%): Higher values mean only very similar images are grouped together
- **Time interval** (1–120 seconds): Images taken further apart than this will not be grouped together

Changes trigger automatic regrouping — no need to rescan.

### Export

1. Click to select the images you want to export (cross-group multi-select supported)
2. Click the **Export** button on the right side of the navigation bar
3. Choose the target directory
4. Wait for export to complete

Exported files are the original RAW files.

---

## Development Guide

### Prerequisites

- Node.js 18+
- Rust 1.70+ (install via [rustup](https://rustup.rs))
- Windows: Microsoft Visual C++ Build Tools or Visual Studio

### Common Commands

```bash
# Install dependencies
npm install

# Start development environment (Rust + React hot reload)
npm run tauri dev

# Production build
npm run tauri build

# Frontend only
npm run dev          # Dev server
npm run build        # Production build

# Type checking
npx tsc --noEmit

# Testing
npx vitest run                         # All frontend tests
npx vitest run src/hooks/useImageLoader.test.ts  # Single test
cd src-tauri && cargo test              # Rust tests
cd src-tauri && cargo test focus_score  # Specific module test
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Zustand + Canvas 2D
- **Backend**: Tauri 2 + Rust (multi-format RAW parsing, pHash, grouping, focus scoring)
- **Bird Detection**: [YOLOv8s](https://github.com/ultralytics/ultralytics) (object detection)
- **Bird Classification**: [osea_mobile](https://github.com/sun-jiao/osea_mobile) (GPL-3.0)
- **Build**: Vite 6
- **Testing**: Vitest (frontend) + cargo test (backend)


## License

[GPL-3.0](LICENSE)
