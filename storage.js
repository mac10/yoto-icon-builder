// Saved-icon library and work-in-progress autosave, backed by localStorage.
const IconStorage = (() => {
  const LIBRARY_KEY = "yotoIcons.library.v1";
  const WIP_KEY = "yotoIcons.wip.v1";
  const HEX_RE = /^#[0-9a-f]{6}$/i;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function isValidIcon(icon) {
    return (
      icon &&
      typeof icon.id === "string" &&
      typeof icon.title === "string" &&
      Array.isArray(icon.pixels) &&
      icon.pixels.length === 256 &&
      icon.pixels.every((p) => p === null || (typeof p === "string" && HEX_RE.test(p)))
    );
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function list() {
    const icons = read(LIBRARY_KEY, []);
    return (Array.isArray(icons) ? icons.filter(isValidIcon) : []).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  function get(id) {
    return list().find((icon) => icon.id === id) || null;
  }

  function findByTitle(title) {
    const t = title.trim().toLowerCase();
    return list().find((icon) => icon.title.trim().toLowerCase() === t) || null;
  }

  // Inserts or updates by id. Returns the saved icon, or null if storage failed.
  function save({ id, title, pixels }) {
    const icon = { id: id || newId(), title: title.trim(), pixels: pixels.slice(), updatedAt: Date.now() };
    const icons = list().filter((i) => i.id !== icon.id);
    icons.push(icon);
    return write(LIBRARY_KEY, icons) ? icon : null;
  }

  function remove(id) {
    return write(LIBRARY_KEY, list().filter((i) => i.id !== id));
  }

  function exportAll() {
    return { app: "yoto-icon-builder", version: 1, exportedAt: new Date().toISOString(), icons: list() };
  }

  // Merges icons from a backup, keeping the newer copy when ids collide.
  // Returns the number of icons added or updated, or -1 if the file is not a backup.
  function importAll(data) {
    const incoming = data && Array.isArray(data.icons) ? data.icons.filter(isValidIcon) : null;
    if (!incoming) return -1;
    const byId = new Map(list().map((i) => [i.id, i]));
    let changed = 0;
    for (const icon of incoming) {
      const existing = byId.get(icon.id);
      if (!existing || (icon.updatedAt || 0) > (existing.updatedAt || 0)) {
        byId.set(icon.id, { id: icon.id, title: icon.title, pixels: icon.pixels, updatedAt: icon.updatedAt || Date.now() });
        changed++;
      }
    }
    return write(LIBRARY_KEY, [...byId.values()]) ? changed : -1;
  }

  function loadWip() {
    const wip = read(WIP_KEY, null);
    if (!wip || !Array.isArray(wip.pixels) || wip.pixels.length !== 256) return null;
    return wip;
  }

  function saveWip(wip) {
    return write(WIP_KEY, wip);
  }

  function available() {
    try {
      const k = "yotoIcons.test";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  return { list, get, findByTitle, save, remove, exportAll, importAll, loadWip, saveWip, available, isValidIcon };
})();
