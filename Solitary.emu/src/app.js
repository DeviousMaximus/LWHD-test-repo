const screenWidth = 256;
const screenHeight = 192;
const screenCount = 2;
const frameBytes = screenWidth * screenHeight * 4 * screenCount;

const $ = (id) => document.getElementById(id);

const statusText = $("statusText");
const screenCanvas = $("screenCanvas");

let Module = null;
let instance = null;
let videoRenderer = null;
let romLoaded = false;

function decodeBase64(value) {
  const clean = value.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function createEmbeddedCore() {
  return globalThis.createPilasMelonDSModule({
    wasmBinary: globalThis.embeddedWasmBinary,

    instantiateWasm(imports, receiveInstance) {
      return WebAssembly.instantiate(globalThis.embeddedWasmBinary, imports).then((result) => {
        receiveInstance(result.instance);
        return result.instance.exports;
      });
    },

    print: (text) => console.log(text),
    printErr: (text) => console.warn(text),
  });
}

async function loadEmbeddedRom() {
  if (!globalThis.embeddedRomBytes || globalThis.embeddedRomBytes.length === 0) {
    statusText.textContent = "No embedded ROM provided";
    return;
  }

  await loadRomBytes(globalThis.embeddedRomBytes, "embedded-game.nds");
}

async function bootCore() {
  Module = await createEmbeddedCore();
  instance = Module._pilas_create(48000);

  await configurePersistedSystemFiles();
  setStatus("Ready");
  await loadEmbeddedRom();
}

function setStatus(text) {
  statusText.textContent = text;
}

function renderFrame() {
  if (!Module || !instance || !videoRenderer) return;
  const ptr = Module._pilas_get_framebuffer_ptr(instance);
  const size = Module._pilas_get_framebuffer_size(instance);
  if (!ptr || size < frameBytes) return;
  videoRenderer.draw(Module.HEAPU8, ptr);
}

async function startAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor({ sampleRate: 48000, latencyHint: "interactive" });
  await context.audioWorklet.addModule(globalThis.embeddedAudioWorkletUrl);

  const node = new AudioWorkletNode(context, "pilas-audio-worklet", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  node.connect(context.destination);
  globalThis.audioContext = context;
  globalThis.audioNode = node;
}

async function init() {
  // minimal renderer setup
  const ctx = screenCanvas.getContext("2d", { alpha: false });
  videoRenderer = {
    mode: "canvas2d",
    label: "Canvas",
    draw(heap, ptr) {
      const image = new ImageData(256, 384);
      image.data.set(heap.subarray(ptr, ptr + frameBytes));
      ctx.putImageData(image, 0, 0);
    }
  };

  await startAudio();
  await bootCore();
}

window.addEventListener("pointerdown", async () => {
  try {
    if (globalThis.audioContext && globalThis.audioContext.state === "suspended") {
      await globalThis.audioContext.resume();
    }
  } catch {}
}, { passive: true });

init();
