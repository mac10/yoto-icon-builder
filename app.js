(() => {
  const SIZE = 16;
  const CELLS = SIZE * SIZE;
  const MAX_UNDO = 50;

  const $ = (id) => document.getElementById(id);
  const board = $("board");
  const ctx = board.getContext("2d");
  const titleInput = $("title");

  const state = {
    pixels: new Array(CELLS).fill(null),
    color: CRAYOLA_64[0].hex,
    tool: "pencil",
    showGrid: true,
    undo: [],
    redo: [],
    currentId: null, // id of the saved icon being edited, if any
    dirty: false, // changed since the last save
  };

  // ---------- Helpers ----------

  const colorName = (hex) => {
    const c = CRAYOLA_64.find((p) => p.hex.toLowerCase() === (hex || "").toLowerCase());
    return c ? c.name : hex;
  };

  const slug = (text) =>
    (text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "yoto-icon";

  const toHex = (r, g, b) =>
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function confirmDialog(message, okLabel = "Yes", cancelLabel = "No") {
    const dialog = $("dialog");
    $("dialog-message").textContent = message;
    $("dialog-ok").textContent = okLabel;
    $("dialog-cancel").textContent = cancelLabel;
    if (typeof dialog.showModal !== "function") return Promise.resolve(window.confirm(message));
    return new Promise((resolve) => {
      dialog.returnValue = "cancel";
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
      dialog.showModal();
    });
  }

  // ---------- Rendering ----------

  // Paints pixels into a 16×16 canvas (used for previews, thumbnails and export).
  function paintSmall(canvas, pixels) {
    const c = canvas.getContext("2d");
    const img = c.createImageData(SIZE, SIZE);
    pixels.forEach((hex, i) => {
      if (!hex) return;
      const [r, g, b] = hexToRgb(hex);
      img.data.set([r, g, b, 255], i * 4);
    });
    c.putImageData(img, 0, 0);
  }

  function resizeBoard() {
    const dpr = window.devicePixelRatio || 1;
    const css = board.getBoundingClientRect().width;
    const px = Math.max(SIZE, Math.round(css * dpr));
    if (board.width !== px) {
      board.width = px;
      board.height = px;
    }
    render();
  }

  function render() {
    const w = board.width;
    const cell = w / SIZE;
    const styles = getComputedStyle(document.documentElement);
    const checkA = styles.getPropertyValue("--check-a").trim() || "#eee";
    const checkB = styles.getPropertyValue("--check-b").trim() || "#fff";

    ctx.clearRect(0, 0, w, w);
    for (let i = 0; i < CELLS; i++) {
      const x = (i % SIZE) * cell;
      const y = Math.floor(i / SIZE) * cell;
      const x0 = Math.round(x), y0 = Math.round(y);
      const x1 = Math.round(x + cell), y1 = Math.round(y + cell);
      const hex = state.pixels[i];
      if (hex) {
        ctx.fillStyle = hex;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        // Checkerboard so kids can see which squares are empty.
        const xm = Math.round(x + cell / 2), ym = Math.round(y + cell / 2);
        ctx.fillStyle = checkB;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = checkA;
        ctx.fillRect(x0, y0, xm - x0, ym - y0);
        ctx.fillRect(xm, ym, x1 - xm, y1 - ym);
      }
    }

    if (state.showGrid) {
      ctx.strokeStyle = "rgba(43, 33, 64, 0.28)";
      ctx.lineWidth = Math.max(1, Math.round(w / 600));
      ctx.beginPath();
      for (let k = 1; k < SIZE; k++) {
        const p = Math.round(k * cell) + 0.5;
        ctx.moveTo(p, 0); ctx.lineTo(p, w);
        ctx.moveTo(0, p); ctx.lineTo(w, p);
      }
      ctx.stroke();
      // Stronger centre lines help with symmetric drawings.
      ctx.strokeStyle = "rgba(43, 33, 64, 0.5)";
      ctx.beginPath();
      const mid = Math.round(8 * cell) + 0.5;
      ctx.moveTo(mid, 0); ctx.lineTo(mid, w);
      ctx.moveTo(0, mid); ctx.lineTo(w, mid);
      ctx.stroke();
    }

    paintSmall($("preview-big"), state.pixels);
    paintSmall($("preview-real"), state.pixels);
  }

  // ---------- History ----------

  function pushUndo(snapshot) {
    state.undo.push(snapshot);
    if (state.undo.length > MAX_UNDO) state.undo.shift();
    state.redo = [];
    updateHistoryButtons();
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(state.pixels.slice());
    state.pixels = state.undo.pop();
    changed();
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(state.pixels.slice());
    state.pixels = state.redo.pop();
    changed();
  }

  function updateHistoryButtons() {
    $("btn-undo").disabled = !state.undo.length;
    $("btn-redo").disabled = !state.redo.length;
  }

  // Call after any change to the drawing.
  function changed() {
    state.dirty = true;
    render();
    updateHistoryButtons();
    updateSaveStatus();
    saveWip();
  }

  // ---------- Drawing ----------

  function cellAt(evt) {
    const rect = board.getBoundingClientRect();
    const x = Math.floor(((evt.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((evt.clientY - rect.top) / rect.height) * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    return { x, y };
  }

  function paintCell(x, y) {
    const value = state.tool === "eraser" ? null : state.color;
    const i = y * SIZE + x;
    if (state.pixels[i] === value) return false;
    state.pixels[i] = value;
    return true;
  }

  // Bresenham line so quick swipes don't leave gaps.
  function paintLine(a, b) {
    let { x: x0, y: y0 } = a;
    const { x: x1, y: y1 } = b;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let any = false;
    for (;;) {
      any = paintCell(x0, y0) || any;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return any;
  }

  function floodFill(x, y, value) {
    const target = state.pixels[y * SIZE + x];
    if (target === value) return false;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) continue;
      const i = cy * SIZE + cx;
      if (state.pixels[i] !== target) continue;
      state.pixels[i] = value;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return true;
  }

  let stroke = null; // { pointerId, last, before, changed }

  board.addEventListener("pointerdown", (evt) => {
    if (stroke || (evt.pointerType === "mouse" && evt.button !== 0)) return;
    const cell = cellAt(evt);
    if (!cell) return;
    evt.preventDefault();

    if (state.tool === "picker") {
      const hex = state.pixels[cell.y * SIZE + cell.x];
      if (hex) {
        setColor(hex);
        setTool("pencil");
        toast(`Picked ${colorName(hex)}`);
      }
      return;
    }

    if (state.tool === "fill") {
      const before = state.pixels.slice();
      if (floodFill(cell.x, cell.y, state.color)) {
        pushUndo(before);
        changed();
      }
      return;
    }

    board.setPointerCapture(evt.pointerId);
    stroke = { pointerId: evt.pointerId, last: cell, before: state.pixels.slice(), changed: false };
    if (paintCell(cell.x, cell.y)) {
      stroke.changed = true;
      render();
    }
  });

  board.addEventListener("pointermove", (evt) => {
    if (!stroke || evt.pointerId !== stroke.pointerId) return;
    const events = evt.getCoalescedEvents ? evt.getCoalescedEvents() : [evt];
    let any = false;
    for (const e of events.length ? events : [evt]) {
      const cell = cellAt(e);
      if (!cell) continue;
      if (cell.x === stroke.last.x && cell.y === stroke.last.y) continue;
      any = paintLine(stroke.last, cell) || any;
      stroke.last = cell;
    }
    if (any) {
      stroke.changed = true;
      render();
    }
  });

  function endStroke(evt) {
    if (!stroke || evt.pointerId !== stroke.pointerId) return;
    if (stroke.changed) {
      pushUndo(stroke.before);
      changed();
    }
    stroke = null;
  }
  board.addEventListener("pointerup", endStroke);
  board.addEventListener("pointercancel", endStroke);
  board.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- Tools & palette ----------

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      const on = btn.dataset.tool === tool;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-checked", String(on));
    });
  }

  function setColor(hex) {
    state.color = hex;
    $("current-swatch").style.background = hex;
    $("current-name").textContent = colorName(hex);
    document.querySelectorAll(".swatch").forEach((s) => {
      const on = s.dataset.hex.toLowerCase() === hex.toLowerCase();
      s.classList.toggle("selected", on);
      s.setAttribute("aria-checked", String(on));
    });
  }

  function buildPalette() {
    const wrap = $("palette");
    for (const { name, hex } of CRAYOLA_64) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = hex;
      b.dataset.hex = hex;
      b.title = name;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", name);
      b.addEventListener("click", () => {
        setColor(hex);
        if (state.tool === "eraser" || state.tool === "picker") setTool("pencil");
      });
      wrap.appendChild(b);
    }
  }

  document.querySelectorAll("[data-tool]").forEach((btn) =>
    btn.addEventListener("click", () => setTool(btn.dataset.tool))
  );
  $("btn-undo").addEventListener("click", undo);
  $("btn-redo").addEventListener("click", redo);
  $("btn-grid").addEventListener("click", (e) => {
    state.showGrid = !state.showGrid;
    e.currentTarget.classList.toggle("active", state.showGrid);
    e.currentTarget.setAttribute("aria-pressed", String(state.showGrid));
    render();
  });
  $("btn-clear").addEventListener("click", async () => {
    if (state.pixels.every((p) => p === null)) return;
    if (!(await confirmDialog("Clear the whole picture?", "Clear it", "Keep it"))) return;
    pushUndo(state.pixels.slice());
    state.pixels.fill(null);
    changed();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (!mod && !e.altKey) {
      const map = { b: "pencil", p: "pencil", e: "eraser", f: "fill", g: "fill", i: "picker" };
      if (map[k]) setTool(map[k]);
    }
  });

  // ---------- Export / import ----------

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function makePng(pixels, scale = 1) {
    const small = document.createElement("canvas");
    small.width = small.height = SIZE;
    paintSmall(small, pixels);
    let out = small;
    if (scale > 1) {
      out = document.createElement("canvas");
      out.width = out.height = SIZE * scale;
      const c = out.getContext("2d");
      c.imageSmoothingEnabled = false;
      c.drawImage(small, 0, 0, out.width, out.height);
    }
    return new Promise((resolve) => out.toBlob(resolve, "image/png"));
  }

  async function downloadIcon(pixels, title, scale = 1) {
    const blob = await makePng(pixels, scale);
    const name = slug(title) + (scale > 1 ? "-big" : "") + ".png";
    downloadBlob(blob, name);
    toast(`Downloaded ${name}`);
  }

  $("btn-download").addEventListener("click", () => downloadIcon(state.pixels, titleInput.value));
  $("btn-download-big").addEventListener("click", () => downloadIcon(state.pixels, titleInput.value, 32));

  $("btn-open").addEventListener("click", () => $("file-open").click());
  $("file-open").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const pixels = await readImagePixels(file);
      pushUndo(state.pixels.slice());
      state.pixels = pixels;
      if (!titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      }
      changed();
      toast("Picture opened");
    } catch {
      toast("Sorry, that picture couldn't be opened");
    }
  });

  function readImagePixels(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = SIZE;
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = cx.getImageData(0, 0, SIZE, SIZE).data;
        const pixels = [];
        for (let i = 0; i < CELLS; i++) {
          const o = i * 4;
          pixels.push(data[o + 3] < 128 ? null : toHex(data[o], data[o + 1], data[o + 2]));
        }
        URL.revokeObjectURL(url);
        resolve(pixels);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("bad image"));
      };
      img.src = url;
    });
  }

  // ---------- Saving & library ----------

  function saveWip() {
    IconStorage.saveWip({
      id: state.currentId,
      title: titleInput.value,
      pixels: state.pixels,
      dirty: state.dirty,
    });
  }

  function updateSaveStatus() {
    const el = $("save-status");
    if (state.dirty) {
      el.textContent = state.currentId ? "You have changes that aren't saved yet." : "Not saved yet.";
      el.classList.add("unsaved");
    } else {
      el.textContent = state.currentId ? "✓ Saved in My Icons" : "";
      el.classList.remove("unsaved");
    }
  }

  async function save() {
    const title = titleInput.value.trim();
    if (!title) {
      toast("Type a song title first");
      titleInput.focus();
      return;
    }
    let id = state.currentId;
    const sameTitle = IconStorage.findByTitle(title);
    if (sameTitle && sameTitle.id !== id) {
      const replace = await confirmDialog(
        `You already have an icon called “${sameTitle.title}”. Replace it?`,
        "Replace",
        "Save as new"
      );
      id = replace ? sameTitle.id : null;
    }
    const saved = IconStorage.save({ id, title, pixels: state.pixels });
    if (!saved) {
      toast("Couldn't save. This browser may be blocking storage.");
      return;
    }
    state.currentId = saved.id;
    state.dirty = false;
    titleInput.value = saved.title;
    saveWip();
    updateSaveStatus();
    renderLibrary();
    toast(`Saved “${saved.title}”`);
  }

  async function okToLeaveCurrent() {
    const blank = state.pixels.every((p) => p === null) && !titleInput.value.trim();
    if (!state.dirty || blank) return true;
    return confirmDialog("Your drawing isn't saved. Leave it anyway?", "Yes, leave it", "No, go back");
  }

  function loadIcon(icon) {
    state.pixels = icon.pixels.slice();
    state.currentId = icon.id;
    titleInput.value = icon.title;
    state.undo = [];
    state.redo = [];
    state.dirty = false;
    render();
    updateHistoryButtons();
    updateSaveStatus();
    saveWip();
    renderLibrary();
  }

  async function newIcon() {
    if (!(await okToLeaveCurrent())) return;
    state.pixels = new Array(CELLS).fill(null);
    state.currentId = null;
    titleInput.value = "";
    state.undo = [];
    state.redo = [];
    state.dirty = false;
    render();
    updateHistoryButtons();
    updateSaveStatus();
    saveWip();
    renderLibrary();
    titleInput.focus();
  }

  function renderLibrary() {
    const icons = IconStorage.list();
    const search = $("library-search");
    const query = search.value.trim().toLowerCase();
    search.hidden = icons.length <= 6;
    const shown = query && !search.hidden ? icons.filter((i) => i.title.toLowerCase().includes(query)) : icons;

    const list = $("library-list");
    list.replaceChildren();
    for (const icon of shown) {
      const card = document.createElement("article");
      card.className = "icon-card" + (icon.id === state.currentId ? " current" : "");

      const thumb = document.createElement("canvas");
      thumb.width = thumb.height = SIZE;
      thumb.title = `Edit “${icon.title}”`;
      paintSmall(thumb, icon.pixels);

      const name = document.createElement("div");
      name.className = "icon-title";
      name.textContent = icon.title;

      const actions = document.createElement("div");
      actions.className = "icon-actions";
      const mk = (label, aria, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.title = aria;
        b.setAttribute("aria-label", `${aria} ${icon.title}`);
        b.addEventListener("click", fn);
        actions.appendChild(b);
      };
      const edit = async () => {
        if (icon.id === state.currentId && !state.dirty) return;
        if (!(await okToLeaveCurrent())) return;
        const fresh = IconStorage.get(icon.id);
        if (fresh) {
          loadIcon(fresh);
          window.scrollTo({ top: 0, behavior: "smooth" });
          toast(`Editing “${fresh.title}”`);
        }
      };
      thumb.addEventListener("click", edit);
      mk("✏️", "Edit", edit);
      mk("⬇️", "Download", () => downloadIcon(icon.pixels, icon.title));
      mk("🗑️", "Delete", async () => {
        if (!(await confirmDialog(`Delete “${icon.title}”?`, "Delete", "Keep it"))) return;
        IconStorage.remove(icon.id);
        if (icon.id === state.currentId) {
          state.currentId = null;
          state.dirty = true;
          updateSaveStatus();
          saveWip();
        }
        renderLibrary();
      });

      card.append(thumb, name, actions);
      list.appendChild(card);
    }
    $("library-empty").hidden = icons.length > 0;
  }

  $("btn-save").addEventListener("click", save);
  $("btn-new").addEventListener("click", newIcon);
  $("library-search").addEventListener("input", renderLibrary);
  titleInput.addEventListener("input", () => {
    state.dirty = true;
    updateSaveStatus();
    saveWip();
  });
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
  });

  $("btn-backup").addEventListener("click", () => {
    const data = IconStorage.exportAll();
    if (!data.icons.length) {
      toast("No saved icons to back up yet");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `yoto-icons-backup-${stamp}.json`);
    toast(`Backed up ${data.icons.length} icon${data.icons.length === 1 ? "" : "s"}`);
  });

  $("btn-restore").addEventListener("click", () => $("file-restore").click());
  $("file-restore").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let count = -1;
    try {
      count = IconStorage.importAll(JSON.parse(await file.text()));
    } catch {
      count = -1;
    }
    if (count < 0) toast("That doesn't look like a Yoto Icon backup");
    else toast(count ? `Restored ${count} icon${count === 1 ? "" : "s"}` : "Everything was already here");
    renderLibrary();
  });

  window.addEventListener("beforeunload", saveWip);

  // ---------- Start ----------

  buildPalette();
  setColor(state.color);
  setTool("pencil");

  const wip = IconStorage.loadWip();
  if (wip) {
    state.pixels = wip.pixels.map((p) => (typeof p === "string" ? p : null));
    titleInput.value = wip.title || "";
    state.currentId = wip.id && IconStorage.get(wip.id) ? wip.id : null;
    state.dirty = !!wip.dirty;
  }

  updateHistoryButtons();
  updateSaveStatus();
  renderLibrary();
  if (!IconStorage.available()) toast("Saving is turned off in this browser, so download your icon!");

  new ResizeObserver(resizeBoard).observe(board);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", render);
  resizeBoard();
})();
