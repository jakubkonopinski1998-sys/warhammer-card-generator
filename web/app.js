// ============ Backend bridge ============
let _backendPromise = null;

async function getBackend() {
    if (_backendPromise) return _backendPromise;
    _backendPromise = (async () => {
        if (window.pywebview?.api) return window.pywebview.api;
        if (typeof initPyodideBridge === "function") {
            const pyodide = await initPyodideBridge();
            return makePyodideAdapter(pyodide);
        }
        throw new Error("Brak backendu (ani pywebview, ani Pyodide).");
    })();
    return _backendPromise;
}

async function backend() { return getBackend(); }

function handleBackendResult(msg) {
    if (typeof msg === "string") { $("status").textContent = msg; return; }
    if (!msg) { $("status").textContent = "Anulowano."; return; }
    if (msg.__download__) {
        const a = document.createElement("a");
        a.href = `data:${msg.mime};base64,${msg.b64}`;
        a.download = msg.filename;
        a.click();
        $("status").textContent = `Pobrano: ${msg.filename}`;
        return;
    }
    if (msg.__status__) { $("status").textContent = msg.__status__; return; }
    $("status").textContent = "OK.";
}

// ============ Globalny stan ============
const DATA = {};
const STATE = {
    talents: [], talents_prof: [], weapon_features: [],
    equipment: [], blessings: [], zoom: 0.6,
};

const $ = id => document.getElementById(id);
const STAT_NAMES = ["WW","US","S","Wt","I","Zw","Zr","Int","SW","Ogd"];

// ============ Religia ============
function professionUsesReligion(prof) {
    if (!prof) return false;
    const clean = prof.replace(/\s*s\.\d+\s*$/i, "").trim();
    return (DATA.religion_professions || []).includes(clean);
}

// ============ Formularz ============
function fillSelect(el, options, selected) {
    el.innerHTML = "";
    for (const o of options) {
        const opt = document.createElement("option");
        opt.value = o; opt.textContent = o;
        if (o === selected) opt.selected = true;
        el.appendChild(opt);
    }
}

function buildStatsGrid() {
    const wrap = $("stats-grid");
    wrap.innerHTML = "";
    for (let i = 0; i < 10; i++) {
        const lbl = document.createElement("label");
        lbl.textContent = STAT_NAMES[i];
        const inp = document.createElement("input");
        inp.type = "number"; inp.id = `stat-${i}`;
        inp.min = 10; inp.max = 95; inp.value = 30;
        inp.addEventListener("input", renderEncumbrance);
        lbl.appendChild(inp);
        const bonusEl = document.createElement("span");
        bonusEl.className = "stat-bonus";
        bonusEl.id = `bonus-${i}`;
        bonusEl.title = "Bonus z talentów (wliczony w wartość na karcie)";
        lbl.appendChild(bonusEl);
        wrap.appendChild(lbl);
    }
}

function refreshNames() {
    const sex = $("inp-sex").value;
    const names = sex === "M" ? DATA.names_m : DATA.names_k;
    const dl = $("names-list");
    dl.innerHTML = "";
    for (const n of names) {
        const o = document.createElement("option"); o.value = n; dl.appendChild(o);
    }
    const sel = $("inp-name-pick");
    sel.innerHTML = '<option value="">— wybierz z pełnej listy —</option>';
    for (const n of names) {
        const o = document.createElement("option");
        o.value = n; o.textContent = n;
        sel.appendChild(o);
    }
}

function refreshProfessions() {
    const cls = $("inp-class").value;
    fillSelect($("inp-prof"), DATA.professions[cls] || []);
    checkReligion();
    populateWeaponFields();
}

function checkReligion() {
    const prof = $("inp-prof").value || "";
    const panel = $("panel-religion");
    if (professionUsesReligion(prof)) {
        panel.style.display = "";
    } else {
        panel.style.display = "none";
        $("inp-god").value = "";
        STATE.blessings = [];
        renderBlessings();
    }
}

function refreshBlessings() {
    const god = $("inp-god").value;
    STATE.blessings = god ? [...(DATA.blessings_by_god[god] || [])] : [];
    renderBlessings();
}

function renderBlessings() {
    const wrap = $("blessings-list");
    wrap.innerHTML = "";
    const descs = DATA.blessing_descriptions || {};
    for (const b of STATE.blessings) {
        const d = document.createElement("div");
        d.className = "chip";
        const info = descs[b];
        if (info) {
            const efekty = [
                info.pc ? `PC: ${info.pc}` : null,
                info.zasieg ? `Zasięg: ${info.zasieg}` : null,
                info.cel ? `Cel: ${info.cel}` : null,
                info.czas ? `Czas: ${info.czas}` : null,
            ].filter(Boolean).join(" · ");
            d.title = (efekty ? efekty + "\n\n" : "") + (info.opis || "");
        }
        d.textContent = b;
        wrap.appendChild(d);
    }
}

function setDesc(elId, text) {
    const el = $(elId);
    if (!el) return;
    if (text) {
        el.textContent = text;
        el.classList.add("desc-filled");
    } else {
        el.textContent = el.dataset.default || "";
        el.classList.remove("desc-filled");
    }
}

function updateWeaponDesc() {
    const name = $("inp-weapon").value;
    const w = DATA.weapons.find(x => x.n === name);
    if (!w) { setDesc("desc-weapon", ""); return; }
    const parts = [];
    if (w.k) parts.push(`Grupa: ${w.k}`);
    if (w.z) parts.push(`Zasięg: ${w.z}`);
    if (w.o) parts.push(`Obc.: ${w.o}`);
    if (w.r) parts.push(`Obrażenia: ${w.r}`);
    if (w.s) parts.push(`Materiał: ${w.s}`);
    if (w.cechy) parts.push(`Wbudowane cechy: ${w.cechy}`);
    setDesc("desc-weapon", parts.join(" · "));
}

function populateWeaponFields() {
    const name = $("inp-weapon").value;
    const w = DATA.weapons.find(x => x.n === name);
    if (!w) return;
    $("inp-weapon-dmg").value = w.r || "";
    updateWeaponDesc();
}

function getStatBonuses() {
    const bonuses = [0,0,0,0,0,0,0,0,0,0];
    const map = { ...(DATA.talent_bonuses || {}), ...(DATA.talent_prof_bonuses || {}) };
    const allTalents = [...STATE.talents, ...STATE.talents_prof];
    for (const t of allTalents) {
        const b = map[t];
        if (b) bonuses[b.stat] += b.value;
    }
    return bonuses;
}

function renderStatBadges() {
    const bonuses = getStatBonuses();
    for (let i = 0; i < 10; i++) {
        const el = $(`bonus-${i}`);
        if (!el) continue;
        if (bonuses[i]) {
            el.textContent = `+${bonuses[i]}`;
            el.title = `Bonus z talentów: +${bonuses[i]}`;
        } else {
            el.textContent = "";
        }
    }
    renderEncumbrance();
}

function renderList(elId, items, onRemove, descMap) {
    const el = $(elId);
    el.innerHTML = "";
    items.forEach((it, idx) => {
        const li = document.createElement("li");
        const isSimple = typeof it === "string";
        const label = isSimple ? it : `${it.name} (${it.weight})`;
        const body = document.createElement("div");
        body.className = "list-body";
        const title = document.createElement("div");
        title.className = "list-title";
        title.textContent = label;
        body.appendChild(title);
        if (descMap && isSimple && descMap[it]) {
            const desc = document.createElement("div");
            desc.className = "list-desc";
            desc.textContent = descMap[it];
            body.appendChild(desc);
        }
        const b = document.createElement("button");
        b.textContent = "×"; b.className = "rm";
        b.onclick = () => { onRemove(idx); };
        li.appendChild(body);
        li.appendChild(b);
        el.appendChild(li);
    });
}

function renderTalents() {
    renderList("talents-list", STATE.talents,
        i => { STATE.talents.splice(i,1); renderTalents(); },
        DATA.talent_descriptions);
    renderStatBadges();
}
function renderTalentsProf() {
    renderList("talents-prof-list", STATE.talents_prof,
        i => { STATE.talents_prof.splice(i,1); renderTalentsProf(); },
        DATA.talent_prof_descriptions);
    renderStatBadges();
}
function renderWeaponFeatures() {
    renderList("weapon-features-list", STATE.weapon_features,
        i => { STATE.weapon_features.splice(i,1); renderWeaponFeatures(); },
        DATA.weapon_feature_descriptions);
}
function renderEquipment() {
    renderList("equip-list", STATE.equipment,
        i => { STATE.equipment.splice(i,1); renderEquipment(); });
    renderEncumbrance();
}

function renderEncumbrance() {
    const el = $("encumbrance");
    if (!el) return;
    const total = STATE.equipment.reduce((s, e) => s + (e.weight || 0), 0);
    const bonuses = getStatBonuses();
    const S  = (+$("stat-2").value || 0) + bonuses[2];
    const Wt = (+$("stat-3").value || 0) + bonuses[3];
    const limit = Math.max(1, Math.floor(S / 10) + Math.floor(Wt / 10));
    const over = total > limit + 0.0001;
    el.textContent = `Obciążenie: ${total.toFixed(1)} / ${limit}`;
    el.classList.toggle("enc-over", over);
    el.classList.toggle("enc-ok", !over);
}

function readFormBase() {
    const stats = [];
    for (let i = 0; i < 10; i++) stats.push(+$(`stat-${i}`).value || 0);
    const w = DATA.weapons.find(x => x.n === $("inp-weapon").value) || {};
    const allTalents = [...STATE.talents, ...STATE.talents_prof];
    const usesReligion = professionUsesReligion($("inp-prof").value);
    return {
        imie: $("inp-name").value,
        plec: $("inp-sex").value,
        rasa: $("inp-race").value,
        klasa: $("inp-class").value,
        sciezka_profesji: $("inp-prof").value,
        status: $("inp-status").value,
        wiek: +$("inp-age").value || 0,
        wzrost: +$("inp-height").value || 0,
        wlosy: $("inp-hair").value,
        oczy: $("inp-eyes").value,
        szybkosc: +$("inp-speed").value || 0,
        stats,
        talenty: allTalents,
        opisy_talentow: allTalents,
        ekwipunek: STATE.equipment.map(e => [e.name, e.weight]),
        bron: {
            n: w.n || "",
            rzadkosc: $("inp-weapon-rarity").value,
            k: w.k || "", o: w.o || 0, z: w.z || "",
            r: $("inp-weapon-dmg").value || w.r || "",
            cechy: STATE.weapon_features.join(", "),
        },
        historia: $("inp-history").value,
        bog: usesReligion ? $("inp-god").value : "",
        blogoslawienstwa: usesReligion ? STATE.blessings : [],
    };
}

function readForm() {
    const d = readFormBase();
    const bonuses = getStatBonuses();
    d.stats = d.stats.map((v, i) => v + bonuses[i]);
    return d;
}

function writeForm(d) {
    if (!d) return;
    $("inp-name").value = d.imie || "";
    $("inp-sex").value = d.plec || "M";
    refreshNames();
    $("inp-race").value = d.rasa || $("inp-race").value;
    $("inp-class").value = d.klasa || $("inp-class").value;
    refreshProfessions();
    $("inp-prof").value = d.sciezka_profesji || $("inp-prof").value;
    checkReligion();
    $("inp-age").value = d.wiek || 0;
    $("inp-height").value = d.wzrost || 0;
    $("inp-hair").value = d.wlosy || $("inp-hair").value;
    $("inp-eyes").value = d.oczy || $("inp-eyes").value;
    $("inp-status").value = d.status || "";
    $("inp-speed").value = d.szybkosc || 0;
    const stats = d.stats || [];
    for (let i = 0; i < 10; i++) $(`stat-${i}`).value = stats[i] || 0;
    const allT = d.talenty || [];
    STATE.talents = allT.filter(t => DATA.talents.includes(t));
    STATE.talents_prof = allT.filter(t => !DATA.talents.includes(t));
    renderTalents();
    renderTalentsProf();
    if (d.bron) {
        if (d.bron.n) $("inp-weapon").value = d.bron.n;
        $("inp-weapon-rarity").value = d.bron.rzadkosc || "Pospolita";
        $("inp-weapon-dmg").value = d.bron.r || "";
        STATE.weapon_features = d.bron.cechy
            ? d.bron.cechy.split(",").map(s => s.trim()).filter(Boolean) : [];
        renderWeaponFeatures();
        updateWeaponDesc();
    }
    STATE.equipment = (d.ekwipunek || []).map(([name, weight]) => ({ name, weight }));
    renderEquipment();
    $("inp-god").value = d.bog || "";
    if (d.blogoslawienstwa) {
        STATE.blessings = [...d.blogoslawienstwa];
        renderBlessings();
    } else {
        refreshBlessings();
    }
    $("inp-history").value = d.historia || "";
}

function applyZoomToImage(img) {
    if (!img.naturalWidth) return;
    img.style.width = Math.round(img.naturalWidth * STATE.zoom) + "px";
}
function applyZoom() {
    document.querySelectorAll(".card-slot img").forEach(applyZoomToImage);
    $("zoom-label").textContent = Math.round(STATE.zoom * 100) + "%";
}
function zoomIn()  { STATE.zoom = Math.min(2.5, STATE.zoom + 0.1); applyZoom(); }
function zoomOut() { STATE.zoom = Math.max(0.15, STATE.zoom - 0.1); applyZoom(); }
function zoomReset() { STATE.zoom = 1.0; applyZoom(); }
function zoomFit() {
    const stage = $("preview-stage");
    const sample = $("preview-1");
    if (!sample?.naturalWidth) return;
    const availW = stage.clientWidth - 40;
    STATE.zoom = availW / sample.naturalWidth;
    // Na mobile nie schodzimy poniżej 0.3 — inaczej tekst nieczytelny
    if (window.innerWidth <= 900 && STATE.zoom < 0.3) {
        STATE.zoom = 0.3;
    }
    applyZoom();
}

// ============ Render ============
function setPreviewImage(page, b64) {
    const img = $(`preview-${page}`);
    if (!img) return;
    if (!b64) {
        const slot = $("slot-" + page);
        if (slot) slot.setAttribute("hidden", "");
        return;
    }
    const slot = $("slot-" + page);
    if (slot) slot.removeAttribute("hidden");
    img.onload = () => applyZoomToImage(img);
    img.src = "data:image/png;base64," + b64;
}

async function renderAll() {
    $("status").textContent = "Renderowanie wszystkich kart...";
    try {
        const b = await backend();
        const data = readForm();
        // SEKWENCYJNIE — każda karta osobno, bez równoległości
        const p1 = await b.render_from_form(data, 1);
        setPreviewImage(1, p1);
        $("status").textContent = "Renderowanie 1/4...";
        const p2 = await b.render_from_form(data, 2);
        setPreviewImage(2, p2);
        $("status").textContent = "Renderowanie 2/4...";
        const p3 = await b.render_from_form(data, 3);
        setPreviewImage(3, p3);
        $("status").textContent = "Renderowanie 3/4...";
        const p4 = await b.render_profession(data);
        setPreviewImage(4, p4);
        $("status").textContent = "Gotowe — wszystkie karty wyrenderowane.";
    } catch (e) {
        $("status").textContent = "Błąd: " + (e?.message || e);
        console.error(e);
    }
}

async function savePng() {
    const page = prompt("Którą stronę zapisać? (1-4)", "1");
    if (!page) return;
    $("status").textContent = "Zapisywanie PNG...";
    try {
        const b = await backend();
        handleBackendResult(await b.save_png(readForm(), +page));
    } catch (e) { $("status").textContent = "Błąd: " + (e?.message || e); console.error(e); }
}

async function savePdf() {
    $("status").textContent = "Zapisywanie PDF...";
    try {
        const b = await backend();
        handleBackendResult(await b.save_pdf(readForm()));
    } catch (e) { $("status").textContent = "Błąd: " + (e?.message || e); console.error(e); }
}

async function saveCharacter() {
    $("status").textContent = "Zapisywanie postaci...";
    try {
        const b = await backend();
        handleBackendResult(await b.save_character(readFormBase()));
    } catch (e) { $("status").textContent = "Błąd: " + (e?.message || e); console.error(e); }
}

async function loadCharacter() {
    $("status").textContent = "Wczytywanie postaci...";
    try {
        const b = await backend();
        const result = await b.load_character();
        if (result && !result.__request_upload__ && !result.__error__) {
            writeForm(result);
            await renderAll();
            $("status").textContent = "Postać wczytana.";
            return;
        }
        if (result && result.__error__) {
            $("status").textContent = "Błąd pliku: " + result.__error__;
            return;
        }
        if (result && result.__request_upload__) {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                const text = await file.text();
                const data = await b.parse_uploaded_json(text);
                if (data.__error__) {
                    $("status").textContent = "Błąd pliku: " + data.__error__;
                    return;
                }
                writeForm(data);
                await renderAll();
                $("status").textContent = "Postać wczytana.";
            };
            input.click();
            return;
        }
        $("status").textContent = "Anulowano.";
    } catch (e) { $("status").textContent = "Błąd: " + (e?.message || e); console.error(e); }
}

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomizeBio() {
    const sex = rnd(["M","K"]);
    $("inp-sex").value = sex;
    refreshNames();
    $("inp-name").value = rnd(sex === "M" ? DATA.names_m : DATA.names_k);
    $("inp-race").value = rnd(DATA.races);
    $("inp-class").value = rnd(DATA.classes);
    refreshProfessions();
    $("inp-prof").value = rnd(DATA.professions[$("inp-class").value] || []);
    checkReligion();
    $("inp-hair").value = rnd(DATA.hair);
    $("inp-eyes").value = rnd(DATA.eyes);
    $("inp-age").value = 20 + Math.floor(Math.random() * 40);
    $("inp-height").value = 160 + Math.floor(Math.random() * 30);
    $("inp-speed").value = 4;
    $("inp-status").value = "Brąz 3";
}

function randomizeStats() {
    for (let i = 0; i < 10; i++) {
        $(`stat-${i}`).value = 20 + Math.floor(Math.random() * 20);
    }
    renderEncumbrance();
}

function randomizeTalents() {
    STATE.talents = [];
    const pool = [...DATA.talents];
    for (let i = 0; i < 2 && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        STATE.talents.push(pool.splice(idx, 1)[0]);
    }
    renderTalents();
}

function randomizeTalentsProf() {
    STATE.talents_prof = [];
    const pool = [...DATA.talents_prof];
    const n = Math.min(2, pool.length);
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        STATE.talents_prof.push(pool.splice(idx, 1)[0]);
    }
    renderTalentsProf();
}

function randomizeWeapon() {
    const w = rnd(DATA.weapons);
    if (!w) return;
    $("inp-weapon").value = w.n;
    $("inp-weapon-rarity").value = "Pospolita";
    $("inp-weapon-dmg").value = w.r || "";
    updateWeaponDesc();
}

function randomizeWeaponFeatures() {
    STATE.weapon_features = [];
    if (DATA.weapon_features.length) {
        const n = Math.random() > 0.5 ? 2 : 1;
        const pool = [...DATA.weapon_features];
        for (let i = 0; i < n && pool.length; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            STATE.weapon_features.push(pool.splice(idx, 1)[0]);
        }
    }
    renderWeaponFeatures();
}

function randomizeEquipment() {
    const eqEntries = Object.entries(DATA.equipment);
    STATE.equipment = [];
    for (let i = 0; i < 5 && eqEntries.length; i++) {
        const idx = Math.floor(Math.random() * eqEntries.length);
        const [name, weight] = eqEntries.splice(idx, 1)[0];
        STATE.equipment.push({ name, weight });
    }
    renderEquipment();
}

function randomizeAll() {
    randomizeBio();
    randomizeStats();
    randomizeTalents();
    randomizeTalentsProf();
    randomizeWeapon();
    randomizeWeaponFeatures();
    randomizeEquipment();
}

async function init() {
    $("status").textContent = "Łączenie z backendem...";
    const b = await backend();
    $("status").textContent = "Pobieranie danych...";
    Object.assign(DATA, await b.get_all_data());

    buildStatsGrid();
    fillSelect($("inp-race"), DATA.races);
    fillSelect($("inp-class"), DATA.classes);
    fillSelect($("inp-hair"), DATA.hair);
    fillSelect($("inp-eyes"), DATA.eyes);
    fillSelect($("inp-god"), DATA.gods);
    fillSelect($("inp-talent"), DATA.talents);
    fillSelect($("inp-talent-prof"), DATA.talents_prof);
    fillSelect($("inp-weapon"), DATA.weapons.map(w => w.n));
    fillSelect($("inp-weapon-feature-select"), DATA.weapon_features);
    fillSelect($("inp-equip"), Object.keys(DATA.equipment));

    document.querySelectorAll(".desc-preview").forEach(el => {
        el.dataset.default = el.textContent.trim();
    });

    refreshNames();
    refreshProfessions();

    $("inp-sex").onchange = () => { refreshNames(); };
    $("inp-class").onchange = refreshProfessions;
    $("inp-prof").onchange = checkReligion;
    $("inp-god").onchange = refreshBlessings;
    $("inp-weapon").onchange = populateWeaponFields;

    $("inp-name-pick").onchange = () => {
        const v = $("inp-name-pick").value;
        if (v) $("inp-name").value = v;
        $("inp-name-pick").value = "";
    };

    $("btn-random-name").onclick = () => {
        const sex = $("inp-sex").value;
        const pool = sex === "M" ? DATA.names_m : DATA.names_k;
        $("inp-name").value = rnd(pool);
    };

    document.querySelector('[data-add="talent"]').onclick = () => {
        const v = $("inp-talent").value;
        if (v && !STATE.talents.includes(v)) { STATE.talents.push(v); renderTalents(); }
    };
    document.querySelector('[data-add="talent-prof"]').onclick = () => {
        const v = $("inp-talent-prof").value;
        if (v && !STATE.talents_prof.includes(v)) { STATE.talents_prof.push(v); renderTalentsProf(); }
    };
    document.querySelector('[data-add="weapon-feature"]').onclick = () => {
        const v = $("inp-weapon-feature-select").value;
        if (v && !STATE.weapon_features.includes(v)) { STATE.weapon_features.push(v); renderWeaponFeatures(); }
    };
    document.querySelector('[data-add="equip"]').onclick = () => {
        const name = $("inp-equip").value;
        if (name && !STATE.equipment.some(e => e.name === name)) {
            STATE.equipment.push({ name, weight: DATA.equipment[name] });
            renderEquipment();
        }
    };

    $("btn-random-bio").onclick = randomizeBio;
    $("btn-random-stats").onclick = randomizeStats;
    $("btn-random-talents").onclick = randomizeTalents;
    $("btn-random-talents-prof").onclick = randomizeTalentsProf;
    $("btn-random-weapon").onclick = randomizeWeapon;
    $("btn-random-weapon-features").onclick = randomizeWeaponFeatures;
    $("btn-random-equip").onclick = randomizeEquipment;

    $("btn-random").onclick = async () => {
        randomizeAll();
        await renderAll();
    };
    $("btn-save-char").onclick = saveCharacter;
    $("btn-load-char").onclick = loadCharacter;
    $("btn-render-all").onclick = renderAll;
    $("btn-save-png").onclick = savePng;
    $("btn-pdf").onclick = savePdf;

    $("btn-zoom-in").onclick = zoomIn;
    $("btn-zoom-out").onclick = zoomOut;
    $("btn-zoom-fit").onclick = zoomFit;
    $("btn-zoom-reset").onclick = zoomReset;

    $("preview-stage").addEventListener("wheel", (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomIn(); else zoomOut();
        }
    }, { passive: false });

    updateWeaponDesc();
    randomizeAll();
    await renderAll();
    zoomFit();
    $("status").textContent = "Gotowe.";
}

window.addEventListener("pywebviewready", () => init().catch(e => {
    $("status").textContent = "Błąd init: " + e.message;
    console.error(e);
}));

if (!window.pywebview?.api && typeof initPyodideBridge === "function") {
    init().catch(e => {
        $("status").textContent = "Błąd init: " + e.message;
        console.error(e);
    });
}
