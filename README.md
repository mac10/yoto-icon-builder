# Yoto Icon Builder

A kid-friendly website for drawing **16 × 16 pixel icons** for Yoto **Make Your Own (MYO)** cards.

- 16 × 16 pixel grid you can draw on with a mouse, a pen or a finger
- The 64 colours from the classic Crayola 64 box, with their crayon names
- Draw, Erase, Fill and Pick tools, plus Undo/Redo, Clear and a grid toggle
- Live preview at real size and big size on a black background (like the Yoto player)
- **Download icon for Yoto** saves a 16 × 16 PNG, the format the Yoto app accepts for MYO icons
- **Song title + My Icons**: name each icon after its song and save it, then come back later to edit it or download it again
- **Backup / Restore** moves saved icons between devices as one JSON file
- Autosave, so a refresh never loses a drawing

It's a plain static site: no build step and no dependencies.

## Run it locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly also works.)

## Put the icon on a Yoto MYO card

1. Draw your icon, type the song title and press **Save**.
2. Press **Download icon for Yoto**. You get a file such as `twinkle-twinkle.png`.
3. In the Yoto app (or at my.yotoplay.com), open your MYO card playlist, edit a track and choose to upload a custom icon.
4. Pick the PNG you downloaded.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| B / P | Draw |
| E | Erase |
| F / G | Fill |
| I | Pick a colour |
| Ctrl/⌘ + Z | Undo |
| Ctrl/⌘ + Y or Shift + Ctrl/⌘ + Z | Redo |

## Where icons are saved

Saved icons are kept in the browser's `localStorage` on that device. Use **Download backup** to keep a copy, and **Restore backup** to load it on another device or browser.

## Deploy

The workflow in `.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. Turn it on under **Settings → Pages → Source: GitHub Actions**.
