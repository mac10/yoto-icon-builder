# Yoto Icon Builder — Plan

## Context
The repo `mac10/yoto-icon-builder` is empty (no commits). The goal is a kid-friendly website for drawing 16×16 pixel icons for Yoto Make-Your-Own (MYO) cards. It must work with a mouse on desktop and with fingers on phones/tablets, offer the 64 colours from the classic Crayola 64 box, and export a file the Yoto app / my.yotoplay.com accepts. Yoto's custom icon upload takes a **16×16 PNG**, so that's the export format.

## Approach
A static site in plain HTML, CSS and JavaScript, with no framework and no build step. It can be opened locally or hosted for free on GitHub Pages.

### Files
- `index.html`: layout (toolbar, 16×16 grid, palette, preview, download button)
- `styles.css`: responsive, large touch targets, bright kid-friendly look, light and dark themes
- `app.js`: drawing state, tools, undo/redo, autosave, export
- `palette.js`: the 64 Crayola colours as `{name, hex}` (classic 64-count box: Black, White, Red, Blue, Yellow, Green, Orange, Violet (Purple), Brown, Carnation Pink, Sky Blue, Scarlet, … Timberwolf, Wild Strawberry, Cerulean, etc., using the published Crayola hex values)
- `README.md`: how to use it, how to upload the icon to a Yoto MYO card, and how to deploy
- `.github/workflows/pages.yml` (optional): deploy to GitHub Pages on push to `main`

### Canvas / grid
- The model is a 256-entry array (`null` = empty/transparent, otherwise a hex colour).
- The grid is drawn on a single `<canvas>`, sized to the viewport with CSS (`min(90vw, 60vh)` square) and scaled with `devicePixelRatio` so it stays crisp. Optional thin gridlines, plus a checkerboard behind empty cells.
- Input uses **Pointer Events** (`pointerdown/move/up` plus `setPointerCapture`), so mouse, pen and touch all go through one code path. `touch-action: none` on the canvas stops scroll and zoom while drawing. Fast drags fill in skipped cells by interpolating between them (Bresenham line).

### Tools (big icon buttons with labels)
- Pencil (default), Eraser, Fill bucket (flood fill), Eyedropper
- Undo / Redo (snapshot stack, about 50 steps; one stroke counts as one step)
- Clear (with a confirm step so a stray tap doesn't wipe the drawing)
- Gridlines toggle

### Palette
- 64 swatches in a wrapping grid: 8 columns on mobile, more on wide screens. Each swatch is at least 40px for small fingers.
- The selected swatch is highlighted, and the colour name ("Wild Strawberry") is shown, which kids enjoy.

### Preview and export
- A live preview shows the icon at actual size (16px) and at 4× with `image-rendering: pixelated`, on a black background (like the Yoto player display).
- **Download PNG**: draws the 256 cells into an offscreen 16×16 canvas and calls `canvas.toBlob('image/png')`, then downloads it as `yoto-icon.png` (or a name the kid types in). Empty cells export as transparent.
- Optional "Download big PNG" (e.g. 512×512, nearest-neighbour scaling) for printing or sharing. The 16×16 PNG is the one meant for MYO.
- **Open PNG**: loads an existing 16×16 PNG back in for editing. Larger images are scaled down with nearest-neighbour, and colours are kept as they are.

### Song title and saved icons ("My Icons")
- A **Song title** text field above the grid, e.g. "Twinkle Twinkle". It's also used as the download filename (`twinkle-twinkle.png`, made filename-safe).
- **Save** button: stores `{id, title, pixels[256], updatedAt}` in the browser's `localStorage` under a "My Icons" library. If the title already exists, it asks whether to overwrite (or the icon keeps its `id` while it's being edited, so Save just updates it). A **New** button starts a blank icon with no title.
- **My Icons** panel: a list or grid of saved icons, each with a small pixel thumbnail and its song title, sorted by most recently edited, with a search box once there are many. Each entry has:
  - **Edit**: loads it into the grid (title included) so the kid can keep working on it
  - **Download**: exports the 16×16 PNG directly, without opening it
  - **Delete** (with a confirm step)
- An unsaved-changes guard: if the drawing has changed since the last save, opening another icon or pressing New asks first.
- **Backup / Restore**: `localStorage` lives only in that one browser, so there's a "Download backup" button that saves all icons to one `yoto-icons-backup.json` and a "Restore backup" button that loads that file (merged by id). This lets icons move to another device or survive clearing browser data.
- The work-in-progress drawing (including the title) also autosaves, so a refresh doesn't lose anything even before Save is pressed. All storage access is wrapped in try/catch, with a friendly message if storage is unavailable.
- Code: put the library logic in a separate `storage.js` (list/get/save/delete/exportAll/importAll).

### Responsive layout
- Phone (portrait): grid on top, tools row, then palette, then preview and download.
- Tablet/desktop: grid in the centre, tools on the left, palette on the right, preview below.
- Viewport meta, no horizontal scroll, all tap targets at least 44px.

## Git
Commit to a feature branch (`master` currently has no commits; default `main`). Initial commit on `main` if the user prefers. No PR unless asked.

## Verification
1. Serve locally (`python3 -m http.server`) and open it in Chromium via Playwright.
2. Script a drag across the canvas on a desktop viewport and on a mobile emulation (iPhone, touch events). Check that the cells fill, and that flood fill, eraser, undo/redo and eyedropper all work.
3. Click Download, then check the saved file is a PNG with dimensions 16×16 (Python `struct` reading of the IHDR chunk) and that its pixel colours match what was drawn.
4. Check there's no horizontal scroll at 360px width, and take screenshots of the desktop and mobile layouts.
5. Reload the page and confirm autosave restores the drawing.
6. Enter a song title and save. Reload, then check the icon appears in My Icons with the correct thumbnail. Edit it, save, and confirm it's updated rather than duplicated. Use the list's Download and check the filename comes from the title. Delete it. Do a backup, clear storage, restore, and confirm the icons come back.
