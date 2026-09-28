/* Pyodide bridge — ładuje Pythona i pliki projektu do wirtualnego FS. */

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PROJECT_ROOT = "/home/pyodide/project";

const PY_FILES = [
    "src/__init__.py",
    "src/api.py",
    "src/domain/__init__.py",
    "src/domain/character.py",
    "src/services/__init__.py",
    "src/services/data_loader.py",
    "src/services/generator.py",
    "src/rendering/__init__.py",
    "src/rendering/markdown.py",
    "src/rendering/renderer.py",
    "src/rendering/widgets/__init__.py",
    "src/utils/__init__.py",
];

const DATA_FILES = [
    "data/content/names.json",
    "data/content/appearance.json",
    "data/content/races.json",
    "data/content/professions.json",
    "data/content/talents.json",
    "data/content/weapons.json",
    "data/content/prayers.json",
    "data/content/equipment.json",
];

const ASSET_FILES = [
    "assets/fonts/Almendra-Regular.ttf",
];

const TEMPLATE_FILES = [
    "assets/images/templates/WW0.png",
    "assets/images/templates/WW1.png",
    "assets/images/templates/WW2.png",
];

// === Dynamiczne ładowanie skryptu Pyodide z CDN ===
function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Nie udało się załadować: ${src}`));
        document.head.appendChild(s);
    });
}

async function ensurePyodideLoaded() {
    if (typeof loadPyodide !== "undefined") return;
    await loadScriptOnce(`${PYODIDE_CDN}pyodide.js`);
    if (typeof loadPyodide === "undefined") {
        throw new Error("loadPyodide nadal niezdefiniowane po załadowaniu skryptu.");
    }
}

async function fetchToFs(pyodide, path, targetPath) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Brak pliku: ${path} (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
    try { pyodide.FS.mkdirTree(dir); } catch (e) {}
    pyodide.FS.writeFile(targetPath, buf);
}

async function initPyodideBridge() {
    logStatus("Ładowanie Pyodide...");
    await ensurePyodideLoaded();
    const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

    logStatus("Instalacja Pillow...");
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("pillow");

    logStatus("Tworzenie struktury katalogów...");
    pyodide.FS.mkdirTree(PROJECT_ROOT);
    pyodide.FS.mkdirTree(`${PROJECT_ROOT}/src`);
    pyodide.FS.mkdirTree(`${PROJECT_ROOT}/data`);
    pyodide.FS.mkdirTree(`${PROJECT_ROOT}/assets`);

    logStatus("Wczytywanie kodu Pythona...");
    for (const f of PY_FILES) {
        await fetchToFs(pyodide, `../${f}`, `${PROJECT_ROOT}/${f}`);
    }

    logStatus("Wczytywanie danych...");
    for (const f of DATA_FILES) {
        await fetchToFs(pyodide, `../${f}`, `${PROJECT_ROOT}/${f}`);
    }

    logStatus("Wczytywanie fontów i szablonów...");
    for (const f of ASSET_FILES) {
        await fetchToFs(pyodide, `../${f}`, `${PROJECT_ROOT}/${f}`);
    }
    for (const f of TEMPLATE_FILES) {
        await fetchToFs(pyodide, `../${f}`, `${PROJECT_ROOT}/${f}`);
    }

    logStatus("Uruchamianie backendu Pythona...");
    pyodide.runPython(`
import sys
sys.path.insert(0, "${PROJECT_ROOT}")
from src.api import Api
_api = Api()
`);

    return pyodide;
}

function logStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = msg;
}

/* Adapter — udaje window.pywebview.api.
 * Zasada: Python zwraca JSON string przez runPython() — Pyodide automatycznie
 * konwertuje końcowe wyrażenie (str) na JS string. JSON.parse po stronie JS. */
function makePyodideAdapter(pyodide) {
    const call = (method, ...args) => {
        pyodide.globals.set("_args", args);
        // Ostatnia linia w runPython jest wyrażeniem — Pyodide zwraca JS string dla str.
        const jsonStr = pyodide.runPython(`
import json as _json
_res = getattr(_api, "${method}")(*_args.to_py())
_json.dumps(_res)
`);
        try { pyodide.globals.delete("_args"); } catch (e) {}
        return JSON.parse(jsonStr);
    };

    return {
        ping: async () => "pong (Pyodide)",
        get_all_data: async () => call("get_all_data"),
        render_from_form: async (data, page) => call("render_from_form", data, page),
        render_profession: async (data) => call("render_profession", data),
        save_pdf: async (data) => call("save_pdf", data),
        save_png: async (data, page) => call("save_png", data, page),
        save_character: async (data) => call("save_character", data),
        load_character: async () => ({ __request_upload__: true }),
        parse_uploaded_json: async (text) => call("parse_uploaded_json", text),
    };
}
