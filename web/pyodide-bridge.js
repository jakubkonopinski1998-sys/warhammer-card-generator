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
    const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
    try { pyodide.FS.mkdirTree(dir); } catch (e) {}
    pyodide.FS.writeFile(targetPath, buf);
}

async function ensureProfessionInFs(pyodide, num) {
    const targetPath = `${PROJECT_ROOT}/assets/images/professions/${num}.png`;
    try {
        pyodide.FS.stat(targetPath);
        return;
    } catch (e) {}
    const webPath = `../assets/images/professions/${num}.png`;
    await fetchToFs(pyodide, webPath, targetPath);
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
    pyodide.FS.mkdirTree(`${PROJECT_ROOT}/assets/images`);
    pyodide.FS.mkdirTree(`${PROJECT_ROOT}/assets/images/professions`);

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

/* Adapter — dane przekazywane jako JSON string.
 * Wywołania są SERIALIZOWANE (kolejka), żeby uniknąć konfliktów na wspólnych
 * zmiennych globalnych Pyodide i wspólnym FS przy równoległych renderach. */
function makePyodideAdapter(pyodide) {
    let _counter = 0;
    let _queue = Promise.resolve();

    const _doCall = async (method, ...args) => {
        const id = ++_counter;
        const resultPath = `/tmp/_result_${id}.json`;
        pyodide.globals.set("_args_json", JSON.stringify(args));
        pyodide.globals.set("_result_path", resultPath);
        await pyodide.runPythonAsync(`
import json as _json
_args = _json.loads(_args_json)
try:
    _res = getattr(_api, "${method}")(*_args)
except Exception as _e:
    _res = {"__pyerror__": f"{type(_e).__name__}: {_e}"}
with open(_result_path, "w", encoding="utf-8") as _f:
    _f.write(_json.dumps(_res))
`);
        const str = pyodide.FS.readFile(resultPath, { encoding: "utf8" });
        try { pyodide.globals.delete("_args_json"); } catch (e) {}
        try { pyodide.globals.delete("_result_path"); } catch (e) {}
        try { pyodide.FS.unlink(resultPath); } catch (e) {}
        const parsed = JSON.parse(str);
        if (parsed && parsed.__pyerror__) {
            throw new Error("Python: " + parsed.__pyerror__);
        }
        return parsed;
    };

    // Kolejka — każde wywołanie czeka aż poprzednie się skończy
    const call = (method, ...args) => {
        const task = _queue.then(() => _doCall(method, ...args));
        _queue = task.catch(() => {}); // nie przerywaj kolejki przy błędzie
        return task;
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
