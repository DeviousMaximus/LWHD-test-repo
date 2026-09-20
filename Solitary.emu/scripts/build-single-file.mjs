import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

const css = read("src/styles.css");
const app = read("src/app.js");
const core = read("src/core/pilas-melonds-core.js")
  .replace("export default createPilasMelonDSModule;", "globalThis.createPilasMelonDSModule = createPilasMelonDSModule;");

const wasmBytes = fs.readFileSync(path.join(root, "assets/pilas-melonds-core.wasm"));
const romBytes = fs.readFileSync(path.join(root, "assets/game.nds"));

const wasmBase64 = Buffer.from(wasmBytes).toString("base64");
const romBase64 = Buffer.from(romBytes).toString("base64");

let template = read("templates/DS.emu.template.html");

template = template.replace("/* __CSS__ */", css);
template = template.replace("/* __CORE__ */", core);
template = template.replace("__WASM_BASE64__", wasmBase64);
template = template.replace("__ROM_BASE64__", romBase64);

const finalApp = app.replace(
  /<\/script>/,
  `</script>`
);

template = template.replace("/* __APP__ */", finalApp);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
write("dist/DS.emu.html", template);

console.log("Built: dist/DS.emu.html");
