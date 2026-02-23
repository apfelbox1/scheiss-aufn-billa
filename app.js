const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "nobilla-counter:v3";
const LEGACY_STORAGE_KEYS = ["nobilla-counter:v2"];

const DEFAULT_STATE = {
    streak: {
        current: 0,
        totalDays: 0,
        longest: 0,
        relapseEvents: [], // [{at: ISO string, currentBeforeReset: number|null}]
        lastTickDate: null // YYYY-MM-DD
    },
    achievementUnlocks: {}, // { [achievementId]: ISO datetime }
    lastAction: null,
    settings: {
        firstDayOfWeek: 0, // 0 = Sunday, 1 = Monday
        lewakasCaptchaEnabled: false
    }
};

const ACHIEVEMENTS = [
    {
        id: "streak_1",
        name: "Heute lieber Hofer",
        requirement: "1 Tag Streak erreichen.",
        unlocked: (ctx) => ctx.current >= 1
    },
    {
        id: "streak_7",
        name: "Geh scheissen sagt der Hausverstand",
        requirement: "7 Tage Streak erreichen.",
        unlocked: (ctx) => ctx.current >= 7
    },
    {
        id: "streak_14",
        name: "Wagerl Verweigerer",
        requirement: "14 Tage Streak erreichen.",
        unlocked: (ctx) => ctx.current >= 14
    },
    {
        id: "streak_30",
        name: "Nicht mal fürn Pfand",
        requirement: "30 Tage Streak erreichen.",
        unlocked: (ctx) => ctx.current >= 30
    },
    {
        id: "streak_60",
        name: "I hoss die oaschbude",
        requirement: "60 Tage Streak erreichen.",
        unlocked: (ctx) => ctx.current >= 60
    },
    {
        id: "total_5",
        name: "Nö Bonus Club",
        requirement: "5 Tage gesamt erreichen.",
        unlocked: (ctx) => ctx.totalDays >= 5
    },
    {
        id: "total_10",
        name: "Angebots Resistenz",
        requirement: "10 Tage gesamt erreichen.",
        unlocked: (ctx) => ctx.totalDays >= 10
    },
    {
        id: "total_20",
        name: "Billa Minus",
        requirement: "20 Tage gesamt erreichen.",
        unlocked: (ctx) => ctx.totalDays >= 20
    },
    {
        id: "relapse_1",
        name: "Jo mei",
        requirement: "1 Rückfall auslösen.",
        unlocked: (ctx) => ctx.relapses >= 1
    },
    {
        id: "relapse_5",
        name: "Der schas Leberkas",
        requirement: "5 Rückfälle auslösen.",
        unlocked: (ctx) => ctx.relapses >= 5
    },
    {
        id: "comeback_7_after_relapse",
        name: "Combeack Kaiser",
        requirement: "Nach mindestens einem Rückfall wieder 7 Tage Streak schaffen.",
        unlocked: (ctx) => ctx.relapses >= 1 && ctx.current >= 7
    },
    {
        id: "relapse_3_in_row",
        name: "I hob nua gschaut",
        requirement: "3 Rückfälle hintereinander (ohne neuen Streak-Tag dazwischen).",
        unlocked: (ctx) => ctx.maxConsecutiveRelapses >= 3
    }
];

const RELAPSE_SNACKBAR_LINES = [
    "Na geh bitte.",
    "Des Budget weint leise.",
    "Oida, war des nötig?",
    "Kurz schwach g'wordn.",
    "Morgen wieder Vollgas.",
    "De scheiss Leberkassemmel",
    "Du und Selbstkontrolle – a schwierige Beziehung.",
    "Aber dann wieder auf r/scheissaufnbilla, ge?",
];

const LEWAKAS_CAPTCHA_TILE_COUNT = 9;
const LEWAKAS_CAPTCHA_MIN_REAL_TILES = 1;
const LEWAKAS_CAPTCHA_MAX_REAL_TILES = 4;
const LEWAKAS_CAPTCHA_MANIFEST_PATH = "img/captcha/lewakas/manifest.json";
const LEWAKAS_CAPTCHA_FAIL_LINES = [
    "Heast, des war ka Lewakas. No amoi.",
    "Na geeeh, da hat di da Gusto verarscht.",
    "Falscher Griff ins Semmerl-Regal. Versuch's nochmal.",
    "Oida, so schaut ka echter Lewakas aus."
];
const LEWAKAS_CAPTCHA_MANIFEST_ERROR = "Lewakas-Captcha fehlt/ist ungültig. Ich lass di diesmal durch.";

function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseISODate(s) {
    const [y, m, d] = String(s || "").split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
}

function daysBetween(aISO, bISO) {
    const a = parseISODate(aISO);
    const b = parseISODate(bISO);
    if (!a || !b) return 0;
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 1000) return "0 Sek";

    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    const parts = [];
    if (d > 0) parts.push(`${d} Tag${d === 1 ? "" : "e"}`);
    if (h > 0) parts.push(`${h} Std`);
    if (m > 0) parts.push(`${m} Min`);
    if (d === 0 && h === 0 && m === 0) parts.push(`${s} Sek`);
    return parts.slice(0, 2).join(" ");
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(list, fallback = null) {
    if (!Array.isArray(list) || list.length === 0) return fallback;
    return list[Math.floor(Math.random() * list.length)];
}

function shuffled(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function pickManyFromPool(pool, count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!Array.isArray(pool) || pool.length === 0 || n === 0) return [];

    if (pool.length >= n) {
        return shuffled(pool).slice(0, n);
    }

    const out = [...pool];
    while (out.length < n) {
        out.push(randomFrom(pool));
    }
    return shuffled(out);
}

function uniqueNonEmptyStrings(input) {
    if (!Array.isArray(input)) return [];
    const out = [];
    const seen = new Set();
    for (const item of input) {
        if (typeof item !== "string") continue;
        const value = item.trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function joinPath(basePath, entryPath) {
    if (!entryPath) return "";
    if (/^(?:[a-z]+:)?\/\//i.test(entryPath)) return entryPath;
    if (entryPath.startsWith("/") || entryPath.startsWith("./") || entryPath.startsWith("../")) return entryPath;
    const base = (basePath || "").replace(/\/+$/, "");
    return base ? `${base}/${entryPath.replace(/^\/+/, "")}` : entryPath;
}

function captchaTypeFromPath(entryPath) {
    const normalized = String(entryPath || "").toLowerCase();
    if (/(^|\/)fake\//.test(normalized)) return "fake";
    if (/(^|\/)real\//.test(normalized)) return "real";
    return null;
}

function normalizeLewakasCaptchaManifest(manifest) {
    const obj = (manifest && typeof manifest === "object") ? manifest : {};
    const basePath = (typeof obj.basePath === "string" && obj.basePath.trim())
        ? obj.basePath.trim()
        : "img/captcha/lewakas";

    const real = [];
    const fake = [];

    for (const path of uniqueNonEmptyStrings(obj.real)) {
        real.push(joinPath(basePath, path));
    }

    for (const path of uniqueNonEmptyStrings(obj.fake)) {
        fake.push(joinPath(basePath, path));
    }

    for (const path of uniqueNonEmptyStrings(obj.files)) {
        const fullPath = joinPath(basePath, path);
        const type = captchaTypeFromPath(path);
        if (type === "fake") {
            fake.push(fullPath);
        } else if (type === "real") {
            real.push(fullPath);
        }
    }

    return {
        real: uniqueNonEmptyStrings(real),
        fake: uniqueNonEmptyStrings(fake)
    };
}

function normalizeRelapseEvents(input) {
    if (!Array.isArray(input)) return [];

    const normalized = [];
    for (const item of input) {
        if (typeof item === "string") {
            if (Number.isFinite(new Date(item).getTime())) {
                normalized.push({ at: item, currentBeforeReset: null });
            }
            continue;
        }

        if (!item || typeof item !== "object") continue;
        const at = item.at;
        if (!Number.isFinite(new Date(at).getTime())) continue;

        const cbr = Number(item.currentBeforeReset);
        normalized.push({
            at,
            currentBeforeReset: Number.isFinite(cbr) ? Math.max(0, Math.floor(cbr)) : null
        });
    }

    normalized.sort((a, b) => new Date(a.at) - new Date(b.at));
    return normalized;
}

function normalizeAchievementUnlocks(input) {
    if (!input || typeof input !== "object") return {};
    const out = {};
    for (const a of ACHIEVEMENTS) {
        const v = input[a.id];
        if (typeof v === "string" && Number.isFinite(new Date(v).getTime())) out[a.id] = v;
    }
    return out;
}

function normalizeStreak(input) {
    const today = todayISO();
    const out = (input && typeof input === "object") ? { ...input } : {};

    const legacyCurrent = (typeof out.lastResetDate === "string")
        ? Math.max(0, daysBetween(out.lastResetDate, today))
        : 0;

    let current = Number(out.current);
    if (!Number.isFinite(current)) current = legacyCurrent;
    current = Math.max(0, Math.floor(current));

    let totalDays = Number(out.totalDays);
    if (!Number.isFinite(totalDays)) totalDays = current;
    totalDays = Math.max(0, Math.floor(totalDays));

    let longest = Number(out.longest);
    if (!Number.isFinite(longest)) longest = current;
    longest = Math.max(current, Math.floor(longest));

    const relapseEvents = normalizeRelapseEvents(out.relapseEvents || out.resetEvents);

    const lastTickDate = typeof out.lastTickDate === "string" ? out.lastTickDate : today;

    return {
        current,
        totalDays,
        longest,
        relapseEvents,
        lastTickDate
    };
}

function normalizeSettings(input) {
    const out = (input && typeof input === "object") ? { ...input } : {};
    return {
        firstDayOfWeek: (out.firstDayOfWeek === 1) ? 1 : 0,
        lewakasCaptchaEnabled: out.lewakasCaptchaEnabled === true
    };
}

function normalizeState(input) {
    const out = (input && typeof input === "object") ? { ...input } : {};
    return {
        streak: normalizeStreak(out.streak),
        achievementUnlocks: normalizeAchievementUnlocks(out.achievementUnlocks),
        lastAction: null,
        settings: normalizeSettings(out.settings)
    };
}

function readRawState() {
    const preferred = localStorage.getItem(STORAGE_KEY);
    if (preferred) return preferred;

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const raw = localStorage.getItem(legacyKey);
        if (raw) return raw;
    }

    return null;
}

function loadState() {
    try {
        const raw = readRawState();
        if (!raw) {
            const fresh = structuredClone(DEFAULT_STATE);
            fresh.streak.lastTickDate = todayISO();
            return fresh;
        }
        return normalizeState(JSON.parse(raw));
    } catch {
        const fresh = structuredClone(DEFAULT_STATE);
        fresh.streak.lastTickDate = todayISO();
        return fresh;
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function advanceStreakToToday() {
    state.streak = normalizeStreak(state.streak);

    const today = todayISO();
    const diff = daysBetween(state.streak.lastTickDate, today);

    if (diff > 0) {
        state.streak.current += diff;
        state.streak.totalDays += diff;
        state.streak.longest = Math.max(state.streak.longest, state.streak.current);
        state.streak.lastTickDate = today;
        return true;
    }

    if (diff < 0) {
        state.streak.lastTickDate = today;
        return true;
    }

    return false;
}

function resetStreak() {
    advanceStreakToToday();

    state.lastAction = {
        type: "streak-reset",
        prevStreak: structuredClone(state.streak),
        prevAchievementUnlocks: structuredClone(state.achievementUnlocks)
    };

    const currentBeforeReset = state.streak.current;
    state.streak.current = 0;
    state.streak.lastTickDate = todayISO();
    state.streak.relapseEvents.push({ at: new Date().toISOString(), currentBeforeReset });

    saveState();
    render();
}

function setCurrentStreakExplicit(value) {
    advanceStreakToToday();

    const next = Math.max(0, Math.floor(Number(value) || 0));

    state.lastAction = {
        type: "streak-set",
        prevStreak: structuredClone(state.streak),
        prevAchievementUnlocks: structuredClone(state.achievementUnlocks)
    };

    state.streak.current = next;
    state.streak.longest = Math.max(state.streak.longest, next);
    state.streak.lastTickDate = todayISO();

    saveState();
    render();
}

function undoLast() {
    const action = state.lastAction;
    if (!action) return;

    if (action.type === "streak-reset" || action.type === "streak-set") {
        state.streak = normalizeStreak(action.prevStreak || null);
        state.achievementUnlocks = normalizeAchievementUnlocks(action.prevAchievementUnlocks || {});
        state.lastAction = null;
        saveState();
        render();
    }
}

function resetWeekdayStats() {
    const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const counts = Array.from({ length: 7 }, (_, i) => ({ label: names[i], count: 0 }));

    for (const event of state.streak.relapseEvents) {
        const dt = new Date(event.at);
        if (!Number.isFinite(dt.getTime())) continue;
        counts[dt.getDay()].count += 1;
    }

    if (state.settings.firstDayOfWeek === 1) {
        // Rotate so that Monday is first
        counts.push(counts.shift());
    }

    return counts;
}

function renderBarList(containerId, items) {
    const root = $(containerId);
    if (!root) return;

    root.innerHTML = "";
    const max = Math.max(1, ...items.map((x) => x.count));

    for (const item of items) {
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
            <div class="bar-label">${item.label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((item.count / max) * 100)}%"></div></div>
            <div class="bar-value">${item.count}</div>
        `;
        root.appendChild(row);
    }
}

function drawHomeArc(progressRatio) {
    const arc = $("counterArcProgress");
    const track = $("counterArcTrack");
    if (!arc || !track) return;

    const length = arc.getTotalLength();
    const clamped = Math.max(0, Math.min(1, progressRatio));
    const visible = length * clamped;

    arc.style.strokeDasharray = `${length}`;
    arc.style.strokeDashoffset = `${Math.max(0, length - visible)}`;
    arc.style.stroke = "rgba(57, 217, 138, .9)";
}

function renderProgressToNextPoint() {
    const now = new Date();
    const nextPointAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msPerDay = 24 * 60 * 60 * 1000;
    const msUntilNextPoint = Math.max(0, nextPointAt.getTime() - now.getTime());
    const progress = Math.max(0, Math.min(1, 1 - (msUntilNextPoint / msPerDay)));

    const goalText = $("goalText");
    const goalBar = $("goalBar");
    const goalHint = $("goalHint");

    if (goalText) goalText.textContent = `${Math.round(progress * 100)}%`;

    if (goalBar) {
        goalBar.style.width = `${Math.round(progress * 100)}%`;
        goalBar.style.background = "rgba(57,217,138,.75)";
    }

    if (goalHint) goalHint.textContent = `Nächster Punkt in ${formatDuration(msUntilNextPoint)}.`;

    drawHomeArc(progress);
}

function achievementContext() {
    const current = state.streak.current;
    const totalDays = state.streak.totalDays;
    const relapses = state.streak.relapseEvents.length;

    let maxConsecutiveRelapses = 0;
    let run = 0;
    for (const event of state.streak.relapseEvents) {
        if (event.currentBeforeReset === 0) {
            run += 1;
        } else {
            run = 1;
        }
        maxConsecutiveRelapses = Math.max(maxConsecutiveRelapses, run);
    }

    return { current, totalDays, relapses, maxConsecutiveRelapses };
}

function unlockAchievementsIfNeeded() {
    state.achievementUnlocks = normalizeAchievementUnlocks(state.achievementUnlocks);
    const ctx = achievementContext();
    let changed = false;

    for (const achievement of ACHIEVEMENTS) {
        if (state.achievementUnlocks[achievement.id]) continue;
        if (!achievement.unlocked(ctx)) continue;
        state.achievementUnlocks[achievement.id] = new Date().toISOString();
        changed = true;
    }

    return changed;
}

function unlockedAchievementsNewestFirst() {
    return ACHIEVEMENTS
        .filter((a) => Boolean(state.achievementUnlocks[a.id]))
        .sort((a, b) => new Date(state.achievementUnlocks[b.id]) - new Date(state.achievementUnlocks[a.id]));
}

function renderRecentAchievements() {
    const root = $("recentBadges");
    const hint = $("recentBadgesHint");
    if (!root) return;

    const recent = unlockedAchievementsNewestFirst().slice(0, 3);
    root.innerHTML = "";

    if (recent.length === 0) {
        if (hint) hint.textContent = "Noch keine Achievements freigeschaltet.";
        return;
    }

    for (const a of recent) {
        const el = document.createElement("div");
        el.className = "badge";
        el.textContent = `✓ ${a.name}`;
        root.appendChild(el);
    }

    if (hint) hint.textContent = "";
}

function renderAllAchievements() {
    const root = $("badges");
    const requirementText = $("badgeRequirementText");
    if (!root) return;

    root.innerHTML = "";
    for (const a of ACHIEVEMENTS) {
        const unlocked = Boolean(state.achievementUnlocks[a.id]);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `badge badge-button${unlocked ? "" : " locked"}`;
        btn.textContent = unlocked ? `✓ ${a.name}` : `• ${a.name}`;

        btn.addEventListener("click", () => {
            if (!requirementText) return;
            if (unlocked) {
                requirementText.textContent = `"${a.name}" ist bereits freigeschaltet.`;
            } else {
                requirementText.textContent = `"${a.name}" freischalten: ${a.requirement}`;
            }
        });

        root.appendChild(btn);
    }
}

function render() {
    if (advanceStreakToToday()) saveState();

    if (unlockAchievementsIfNeeded()) saveState();

    const current = state.streak.current;
    const longest = state.streak.longest;
    const totalDays = state.streak.totalDays;
    const relapses = state.streak.relapseEvents.length;

    $("countToday").textContent = String(current);

    const homeCurrent = $("homeCurrent");
    const homeLongest = $("homeLongest");
    const homeTotalDays = $("homeTotalDays");
    const homeRelapses = $("homeRelapses");
    if (homeCurrent) homeCurrent.textContent = String(current);
    if (homeLongest) homeLongest.textContent = String(longest);
    if (homeTotalDays) homeTotalDays.textContent = String(totalDays);
    if (homeRelapses) homeRelapses.textContent = String(relapses);

    const statsCurrent = $("statsCurrent");
    const statsLongest = $("statsLongest");
    const statsTotalDays = $("statsTotalDays");
    const statsRelapses = $("statsRelapses");
    if (statsCurrent) statsCurrent.textContent = String(current);
    if (statsLongest) statsLongest.textContent = String(longest);
    if (statsTotalDays) statsTotalDays.textContent = String(totalDays);
    if (statsRelapses) statsRelapses.textContent = String(relapses);

    const weekdayCounts = resetWeekdayStats();
    renderBarList("resetWeekdayBars", weekdayCounts);

    const topWeekday = weekdayCounts.reduce(
        (best, cur) => (cur.count > best.count ? cur : best),
        weekdayCounts[0]
    );

    const topWeekdayEl = $("resetTopWeekday");
    const topWeekdayMetaEl = $("resetTopWeekdayMeta");

    if (topWeekdayEl) topWeekdayEl.textContent = relapses > 0 ? topWeekday.label : "—";
    if (topWeekdayMetaEl) {
        topWeekdayMetaEl.textContent = relapses > 0
            ? `${topWeekday.count} Rückfälle`
            : "Noch keine Rückfälle";
    }

    $("undoHint").textContent = state.lastAction ? "Undo verfügbar." : "—";

    const firstDayOfWeekSelect = $("firstDayOfWeek");
    if (firstDayOfWeekSelect && document.activeElement !== firstDayOfWeekSelect) {
        firstDayOfWeekSelect.value = String(state.settings?.firstDayOfWeek || 0);
    }

    const lewakasCaptchaToggle = $("lewakasCaptchaEnabled");
    if (lewakasCaptchaToggle && document.activeElement !== lewakasCaptchaToggle) {
        lewakasCaptchaToggle.checked = Boolean(state.settings?.lewakasCaptchaEnabled);
    }

    renderRecentAchievements();
    renderAllAchievements();
    renderProgressToNextPoint();
}

function hideUndoSnackbar() {
    const snackbar = $("undoSnackbar");
    if (!snackbar) return;

    snackbar.classList.remove("show");

    if (snackbarTimer) {
        clearTimeout(snackbarTimer);
        snackbarTimer = null;
    }
}

function showUndoSnackbar() {
    const snackbar = $("undoSnackbar");
    if (!snackbar) return;
    const snackbarText = $("snackbarText");
    if (snackbarText) {
        const idx = Math.floor(Math.random() * RELAPSE_SNACKBAR_LINES.length);
        snackbarText.textContent = RELAPSE_SNACKBAR_LINES[idx];
    }

    snackbar.classList.add("show");

    if (snackbarTimer) clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(() => {
        snackbar.classList.remove("show");
        snackbarTimer = null;
    }, 5000);
}

async function ensureLewakasCaptchaPoolLoaded() {
    if (lewakasCaptchaPool.real.length > 0 && lewakasCaptchaPool.fake.length > 0) return true;
    if (lewakasCaptchaPoolLoadPromise) return lewakasCaptchaPoolLoadPromise;

    lewakasCaptchaPoolLoadPromise = (async () => {
        try {
            const response = await fetch(LEWAKAS_CAPTCHA_MANIFEST_PATH, { cache: "no-store" });
            if (!response.ok) return false;

            const manifest = await response.json();
            const normalized = normalizeLewakasCaptchaManifest(manifest);
            if (normalized.real.length === 0 || normalized.fake.length === 0) return false;

            lewakasCaptchaPool = normalized;
            return true;
        } catch {
            return false;
        } finally {
            lewakasCaptchaPoolLoadPromise = null;
        }
    })();

    return lewakasCaptchaPoolLoadPromise;
}

function createLewakasCaptchaChallenge() {
    const realPool = lewakasCaptchaPool.real;
    const fakePool = lewakasCaptchaPool.fake;
    if (realPool.length === 0 || fakePool.length === 0) return null;

    const maxRealByGrid = Math.max(1, LEWAKAS_CAPTCHA_TILE_COUNT - 1);
    const realMin = Math.min(LEWAKAS_CAPTCHA_MIN_REAL_TILES, maxRealByGrid);
    const realMax = Math.min(LEWAKAS_CAPTCHA_MAX_REAL_TILES, maxRealByGrid);
    const realCount = randomInt(realMin, realMax);
    const wrongCount = LEWAKAS_CAPTCHA_TILE_COUNT - realCount;
    const tiles = [
        ...pickManyFromPool(realPool, realCount).map((src) => ({
            isReal: true,
            src,
            fallbackLabel: "Lewakas"
        })),
        ...pickManyFromPool(fakePool, wrongCount).map((src) => ({
            isReal: false,
            src,
            fallbackLabel: "Ned"
        }))
    ];

    const mixedTiles = shuffled(tiles).slice(0, LEWAKAS_CAPTCHA_TILE_COUNT);
    const correctIndexes = new Set();
    mixedTiles.forEach((tile, index) => {
        if (tile.isReal) correctIndexes.add(index);
    });

    return {
        tiles: mixedTiles,
        correctIndexes,
        selectedIndexes: new Set()
    };
}

function setLewakasCaptchaError(text) {
    const errorEl = $("lewakasCaptchaError");
    if (!errorEl) return;
    errorEl.textContent = text || "";
}

function renderLewakasCaptchaGrid() {
    const grid = $("lewakasCaptchaGrid");
    if (!grid || !activeLewakasCaptcha) return;

    grid.innerHTML = "";

    activeLewakasCaptcha.tiles.forEach((tile, index) => {
        const tileBtn = document.createElement("button");
        tileBtn.type = "button";
        tileBtn.className = "captcha-tile";
        tileBtn.setAttribute("aria-pressed", "false");
        tileBtn.setAttribute("aria-label", `Captcha Bild ${index + 1}`);

        const img = document.createElement("img");
        img.alt = tile.isReal ? "Lewakas Bild" : "Anderes Bild";

        const fallback = document.createElement("span");
        fallback.className = "captcha-fallback";
        fallback.textContent = tile.fallbackLabel;
        fallback.hidden = true;

        if (typeof tile.src === "string" && tile.src.length > 0) {
            img.src = tile.src;
            img.loading = "lazy";
            img.decoding = "async";
            img.addEventListener("error", () => {
                img.hidden = true;
                fallback.hidden = false;
            });
        } else {
            img.hidden = true;
            fallback.hidden = false;
        }

        tileBtn.appendChild(img);
        tileBtn.appendChild(fallback);

        tileBtn.addEventListener("click", () => {
            const selected = activeLewakasCaptcha.selectedIndexes.has(index);
            if (selected) {
                activeLewakasCaptcha.selectedIndexes.delete(index);
            } else {
                activeLewakasCaptcha.selectedIndexes.add(index);
            }

            const nextState = !selected;
            tileBtn.classList.toggle("selected", nextState);
            tileBtn.setAttribute("aria-pressed", String(nextState));
        });

        grid.appendChild(tileBtn);
    });
}

function refreshLewakasCaptcha(errorText = "") {
    activeLewakasCaptcha = createLewakasCaptchaChallenge();
    if (!activeLewakasCaptcha) return false;
    renderLewakasCaptchaGrid();
    setLewakasCaptchaError(errorText);
    return true;
}

async function openLewakasCaptcha() {
    const modal = $("lewakasCaptchaModal");
    if (!modal) return false;

    const loaded = await ensureLewakasCaptchaPoolLoaded();
    if (!loaded) return false;

    const challengeCreated = refreshLewakasCaptcha("");
    if (!challengeCreated) return false;

    modal.hidden = false;
    const firstTile = modal.querySelector(".captcha-tile");
    if (firstTile) firstTile.focus();
    return true;
}

function closeLewakasCaptcha(cancelPendingAction = true) {
    const modal = $("lewakasCaptchaModal");
    if (modal) modal.hidden = true;
    activeLewakasCaptcha = null;
    setLewakasCaptchaError("");

    if (cancelPendingAction) pendingProtectedAction = null;
}

function lewakasCaptchaSolved() {
    if (!activeLewakasCaptcha) return false;
    const selected = activeLewakasCaptcha.selectedIndexes;
    const correct = activeLewakasCaptcha.correctIndexes;
    if (selected.size !== correct.size) return false;

    for (const index of selected) {
        if (!correct.has(index)) return false;
    }
    return true;
}

function confirmLewakasCaptcha() {
    if (!activeLewakasCaptcha) return;

    if (!lewakasCaptchaSolved()) {
        const failLine = randomFrom(LEWAKAS_CAPTCHA_FAIL_LINES, "No amoi probieren.");
        refreshLewakasCaptcha(failLine);
        return;
    }

    const action = pendingProtectedAction;
    closeLewakasCaptcha(false);
    pendingProtectedAction = null;
    if (typeof action === "function") action();
}

function triggerStreakResetWithOptionalCaptcha() {
    const captchaEnabled = Boolean(state.settings?.lewakasCaptchaEnabled);
    if (!captchaEnabled) {
        resetStreak();
        showUndoSnackbar();
        return;
    }

    pendingProtectedAction = () => {
        resetStreak();
        showUndoSnackbar();
    };

    openLewakasCaptcha().then((opened) => {
        if (opened) return;
        alert(LEWAKAS_CAPTCHA_MANIFEST_ERROR);
        const action = pendingProtectedAction;
        pendingProtectedAction = null;
        if (typeof action === "function") action();
    }).catch(() => {
        alert(LEWAKAS_CAPTCHA_MANIFEST_ERROR);
        const action = pendingProtectedAction;
        pendingProtectedAction = null;
        if (typeof action === "function") action();
    });
}

function setupLewakasCaptchaControls() {
    const toggle = $("lewakasCaptchaEnabled");
    if (toggle) {
        toggle.checked = Boolean(state.settings?.lewakasCaptchaEnabled);
        toggle.addEventListener("change", (e) => {
            state.settings.lewakasCaptchaEnabled = e.target.checked === true;
            saveState();
            render();
        });
    }

    const infoBtn = $("lewakasCaptchaInfoBtn");
    const infoTooltip = $("lewakasCaptchaInfoTooltip");
    const closeInfoTooltip = () => {
        if (!infoTooltip || !infoBtn) return;
        infoTooltip.hidden = true;
        infoBtn.setAttribute("aria-expanded", "false");
    };

    if (infoBtn && infoTooltip) {
        infoBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !infoTooltip.hidden;
            infoTooltip.hidden = isOpen;
            infoBtn.setAttribute("aria-expanded", String(!isOpen));
        });

        document.addEventListener("click", (e) => {
            if (infoTooltip.hidden) return;
            if (e.target === infoBtn) return;
            if (infoTooltip.contains(e.target)) return;
            closeInfoTooltip();
        });
    }

    const cancelBtn = $("lewakasCaptchaCancel");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            closeLewakasCaptcha(true);
        });
    }

    const confirmBtn = $("lewakasCaptchaConfirm");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
            confirmLewakasCaptcha();
        });
    }

    const modal = $("lewakasCaptchaModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeLewakasCaptcha(true);
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        closeInfoTooltip();
        if (!$("lewakasCaptchaModal")?.hidden) closeLewakasCaptcha(true);
    });
}

function setupTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const views = Array.from(document.querySelectorAll(".tab-view"));

    const setActiveTab = (tabId) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.tab === tabId);
        });

        views.forEach((view) => {
            view.classList.toggle("active", view.dataset.view === tabId);
        });
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
    });
}

function syncBackupText() {
    const backupText = $("backupText");

    if (backupText && document.activeElement !== backupText) {
        backupText.value = JSON.stringify(state);
    }
}

function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `nobilla-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

function importFromObject(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
    state = normalizeState(obj);
    saveState();
    syncBackupText();
    render();
}

let state = loadState();
let sinceLastTimer = null;
let snackbarTimer = null;
let lastRenderedDay = todayISO();
let pendingProtectedAction = null;
let activeLewakasCaptcha = null;
let lewakasCaptchaPool = { real: [], fake: [] };
let lewakasCaptchaPoolLoadPromise = null;

window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(() => { });
    }

    setupTabs();
    setupLewakasCaptchaControls();
    syncBackupText();

    if (!sinceLastTimer) {
        sinceLastTimer = setInterval(() => {
            renderProgressToNextPoint();
            const day = todayISO();
            if (day !== lastRenderedDay) {
                lastRenderedDay = day;
                render();
            }
        }, 1000);
    }

    const btnResetStreak = $("btnResetStreak");
    if (btnResetStreak) {
        btnResetStreak.addEventListener("click", () => {
            triggerStreakResetWithOptionalCaptcha();
        });
    }

    const snackbarUndo = $("snackbarUndo");
    if (snackbarUndo) {
        snackbarUndo.addEventListener("click", () => {
            undoLast();
            hideUndoSnackbar();
        });
    }

    const btnUndo = $("btnUndo");
    if (btnUndo) btnUndo.addEventListener("click", undoLast);

    const btnSet = $("btnSet");
    if (btnSet) {
        btnSet.addEventListener("click", () => {
            const raw = prompt("Aktuellen Streak setzen auf:", String(state.streak.current));
            if (raw === null) return;
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) {
                alert("Bitte eine gültige Zahl eingeben.");
                return;
            }
            setCurrentStreakExplicit(Math.floor(n));
        });
    }

    const btnReset = $("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            const ok = confirm("Wirklich ALLES löschen?");
            if (!ok) return;

            state = structuredClone(DEFAULT_STATE);
            state.streak.lastTickDate = todayISO();
            saveState();
            syncBackupText();
            render();
        });
    }

    const btnExport = $("btnExport");
    if (btnExport) {
        btnExport.addEventListener("click", (e) => {
            e.preventDefault();
            exportJSON();
        });
    }

    const importFile = $("importFile");
    if (importFile) {
        importFile.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                importFromObject(JSON.parse(text));
                alert("Import erfolgreich.");
            } catch (err) {
                alert("Import fehlgeschlagen: " + (err?.message || String(err)));
            } finally {
                e.target.value = "";
            }
        });
    }

    const btnImportText = $("btnImportText");
    if (btnImportText) {
        btnImportText.addEventListener("click", (e) => {
            e.preventDefault();
            try {
                importFromObject(JSON.parse($("backupText")?.value || "{}"));
                alert("Import erfolgreich.");
            } catch (err) {
                alert("Import fehlgeschlagen: " + (err?.message || String(err)));
            }
        });
    }

    const firstDayOfWeekSelect = $("firstDayOfWeek");
    if (firstDayOfWeekSelect) {
        firstDayOfWeekSelect.value = String(state.settings?.firstDayOfWeek || 0);

        firstDayOfWeekSelect.addEventListener("change", (e) => {
            const value = Number(e.target.value);
            if (value === 0 || value === 1) {
                state.settings.firstDayOfWeek = value;
                saveState();
                render();
            }
        });
    }

    render();
});
