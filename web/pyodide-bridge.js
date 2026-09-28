/* Pyodide bridge — zoptymalizowane, równoległe ładowanie Pythona do wirtualnego FS. */

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
        throw new Error("loadPyodide nadal niezdefiniowane.");
    }
}

async function fetchToFs(pyodide, path, targetPath) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Brak pliku: ${path} (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    pyodide.FS.writeFile(targetPath, buf);
}

async function ensureProfessionInFs(pyodide, num) {
    const targetPath = `${PROJECT_ROOT}/assets/images/professions/${num}.png`;
    try {
        pyodide.FS.stat(targetPath);
        return;
    } catch (e) {}
    const webPath = `../assets/images/professions/${num}.png`;
    const res = await fetch(webPath);
    if (!res.ok) throw new Error(`Brak karty profesji: ${webPath}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    pyodide.FS.writeFile(targetPath, buf);
}

async function notifyProgress(percent, msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = msg;
    if (window.setAppProgress) {
        await window.setAppProgress(percent, msg, "Inicjalizacja silnika...");
    }
}

async function initPyodideBridge() {
    await notifyProgress(15, "Pobieranie środowiska Pyodide (WASM)...");
    await ensurePyodideLoaded();
    const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

    // Zamiast micropip: natywne, prekompilowane Pillow z repozytorium Pyodide
    await notifyProgress(35, "Ładowanie biblioteki graficznej Pillow...");
    await pyodide.loadPackage("pillow");

    await notifyProgress(50, "Tworzenie struktury katalogów...");
    const allFiles = [
        ...PY_FILES.map(f => ({ src: `../${f}`, dest: `${PROJECT_ROOT}/${f}` })),
        ...DATA_FILES.map(f => ({ src: `../${f}`, dest: `${PROJECT_ROOT}/${f}` })),
        ...ASSET_FILES.map(f => ({ src: `../${f}`, dest: `${PROJECT_ROOT}/${f}` })),
        ...TEMPLATE_FILES.map(f => ({ src: `../${f}`, dest: `${PROJECT_ROOT}/${f}` })),
    ];

    // Przygotowanie katalogów w wirtualnym FS
    const dirs = new Set([
        PROJECT_ROOT,
        `${PROJECT_ROOT}/src`,
        `${PROJECT_ROOT}/src/domain`,
        `${PROJECT_ROOT}/src/services`,
        `${PROJECT_ROOT}/src/rendering`,
        `${PROJECT_ROOT}/src/rendering/widgets`,
        `${PROJECT_ROOT}/src/utils`,
        `${PROJECT_ROOT}/data`,
        `${PROJECT_ROOT}/data/content`,
        `${PROJECT_ROOT}/assets`,
        `${PROJECT_ROOT}/assets/fonts`,
        `${PROJECT_ROOT}/assets/images`,
        `${PROJECT_ROOT}/assets/images/templates`,
        `${PROJECT_ROOT}/assets/images/professions`,
    ]);
    for (const d of dirs) {
        try { pyodide.FS.mkdirTree(d); } catch (e) {}
    }

    // RÓWNOLEGŁE pobieranie wszystkich plików przez HTTP/2
    await notifyProgress(65, "Równoległe pobieranie kodu, fontów i szablonów...");
    await Promise.all(allFiles.map(f => fetchToFs(pyodide, f.src, f.dest)));

    await notifyProgress(85, "Kompilacja i start backendu Pythona...");
    pyodide.runPython(`
import sys
sys.path.insert(0, "${PROJECT_ROOT}")
from src.api import Api
_api = Api()

import json as _json
def _dispatch(method_name, args_json):
    _args = _json.loads(args_json)
    try:
        _res = getattr(_api, method_name)(*_args)
    except Exception as _e:
        import traceback
        _res = {"__pyerror__": f"{type(_e).__name__}: {_e}\\n{traceback.format_exc()}"}
    return _json.dumps(_res)
`);

    return pyodide;
}

/* Adapter — używa jednej funkcji Python z argumentami (bez globalnych zmiennych). */
function makePyodideAdapter(pyodide) {
    const _dispatch = pyodide.globals.get("_dispatch");

    const call = async (method, ...args) => {
        const argsJson = JSON.stringify(args);
        const result = _dispatch(method, argsJson);

        let str;
        if (typeof result === "string") {
            str = result;
        } else if (result && typeof result.toString === "function") {
            str = result.toString();
            if (result.destroy) result.destroy();
        } else {
            str = String(result);
        }

        const parsed = JSON.parse(str);
        if (parsed && parsed.__pyerror__) {
            throw new Error("Python: " + parsed.__pyerror__);
        }
        return parsed;
    };

    return {
        ping: async () => "pong (Pyodide)",
        get_all_data: async () => call("get_all_data"),
        render_from_form: async (data, page) => call("render_from_form", data, page),
        render_profession: async (data) => {
            const sciezka = (data && data.sciezka_profesji) || "";
            const m = sciezka.match(/s\.\s*(\d+)/);
            if (m) {
                try {
                    await ensureProfessionInFs(pyodide, m[1]);
                } catch (e) {
                    console.warn("Nie udało się wczytać karty profesji:", e.message);
                }
            }
            return call("render_profession", data);
        },
        save_pdf: async (data) => call("save_pdf", data),
        save_png: async (data, page) => call("save_png", data, page),
        save_character: async (data) => call("save_character", data),
        load_character: async () => ({ __request_upload__: true }),
        parse_uploaded_json: async (text) => call("parse_uploaded_json", text),
    };
}
