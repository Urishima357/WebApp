import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
);
const files = [...walk(join(root, "src")), ...walk(join(root, "public")), join(root, "index.html")];
for (const file of files) {
  assert(!file.endsWith(".svg"), file);
  if (/\.(tsx?|css|html|webmanifest)$/.test(file)) {
    const source = readFileSync(file, "utf8");
    assert(!/<svg\b|data:image\/svg|\.svg\b/i.test(source), file);
    assert(!source.includes("\u2014"), file);
  }
}

const ui = read("src/components/ui.tsx");
const css = read("src/styles/global.css");
const app = read("src/app/App.tsx");
assert(ui.includes('width="640"') && ui.includes('height="420"'));
assert(ui.includes('priority ? "high" : "auto"'));
assert(ui.includes("beforeClose") && ui.includes("Promise.allSettled"));
assert(ui.includes("ArrowRight") && ui.includes("ArrowLeft"));
assert(app.includes("aria-expanded={menu}") && app.includes("inert={menu}"));
assert(app.includes("document.startViewTransition"));
assert(app.includes('className="dashboard-layout"') && app.includes('className="revenue-details"'));
assert(read("src/features/Workshop.tsx").includes('className="mobile-work-orders"'));
assert(read("src/features/Showroom.tsx").includes('viewTransitionName: `motor-${v.id}`'));
assert(css.includes("prefers-reduced-motion: reduce"));
assert(!/transition\s*:\s*all\b/.test(css));
assert(!/(?:width|height|top|left)\s+\d+(?:ms|s)\b/.test(css));

const names = "grid wrench motor box receipt users truck chart settings shield clock bell receive wallet search camera edit alert plus arrow chevron check menu more logout print refresh".split(" ");
for (const name of names) {
  const png = readFileSync(join(root, "public/icons", `${name}.png`));
  assert.equal(png.readUInt32BE(16), 96, name);
  assert.equal(png.readUInt32BE(20), 96, name);
}
for (const icon of JSON.parse(read("public/manifest.webmanifest")).icons) {
  const png = readFileSync(join(root, "public", icon.src));
  const size = Number(icon.sizes.split("x")[0]);
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
console.log("UI checks passed: no SVG, raster assets, dimensions, keyboard, motion guards, modal close.");
