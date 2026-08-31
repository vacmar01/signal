import { createInitialState, createStore, reducer } from "./state.mjs";

const DEFAULT_STATIONS = [
  {
    id: "radio-swiss-jazz",
    name: "Radio Swiss Jazz",
    url: "https://stream.srg-ssr.ch/m/rsj/mp3_128",
    logo: "assets/radio-swiss-jazz.png",
    meta: "JAZZ / SRG SSR / MP3 128K",
  },
  {
    id: "smoothjazz-com-pl",
    name: "SmoothJazz.com.pl",
    url: "https://bcast.vigormultimedia.com:48888/sjcompl320mp3",
    logo: "assets/smoothjazz.png",
    meta: "SMOOTH JAZZ / PL / MP3 320K",
  },
  {
    id: "wdr-4",
    name: "WDR 4",
    url: "https://wdr-wdr4-live.icecastssl.wdr.de/wdr/wdr4/live/mp3/128/stream.mp3",
    logo: "assets/wdr4.png",
    meta: "OLDIES / DE / MP3 128K",
  },
];

const STORAGE_KEY = "webradio.stations";
const RB_BASE = "https://de1.api.radio-browser.info";

function normalizeStations(value) {
  if (!Array.isArray(value)) return null;

  const ids = new Set();
  const normalized = [];
  for (const item of value) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.url !== "string" ||
      !item.id.trim() ||
      !item.name.trim() ||
      !item.url.trim() ||
      ids.has(item.id)
    ) {
      continue;
    }

    ids.add(item.id);
    normalized.push({
      id: item.id,
      name: item.name.trim(),
      url: item.url.trim(),
      ...(typeof item.logo === "string" && item.logo ? { logo: item.logo } : {}),
      ...(typeof item.meta === "string" && item.meta ? { meta: item.meta } : {}),
    });
  }
  return normalized;
}

function loadStations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stations = normalizeStations(JSON.parse(raw));
      if (stations !== null) return stations;
    }
  } catch (error) {
    console.warn("Could not read stations.", error);
  }
  return DEFAULT_STATIONS.map((station) => ({ ...station }));
}

function saveStations(stations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
  } catch (error) {
    console.error("Could not save stations.", error);
  }
}

const store = createStore(reducer, createInitialState(loadStations()));
saveStations(store.getState().stations);

const list = document.getElementById("grid");
const audio = document.getElementById("audio");
const playPauseBtn = document.getElementById("playPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");
const ticker = document.getElementById("ticker");
const editBtn = document.getElementById("editBtn");
const clock = document.getElementById("clock");
const stationDialog = document.getElementById("stationDialog");
const stationForm = document.getElementById("stationForm");
const dialogTitle = document.getElementById("dialogTitle");
const fieldName = document.getElementById("fieldName");
const fieldUrl = document.getElementById("fieldUrl");
const cancelBtn = document.getElementById("cancelBtn");
const deleteBtn = document.getElementById("deleteBtn");
const searchSection = document.getElementById("searchSection");
const manualSection = document.getElementById("manualSection");
const fieldSearch = document.getElementById("fieldSearch");
const searchResults = document.getElementById("searchResults");
const manualBtn = document.getElementById("manualBtn");
const cancelBtn2 = document.getElementById("cancelBtn2");
const saveBtn = document.getElementById("saveBtn");

function stationMeta(station) {
  return station.meta || "INTERNET RADIO / LIVE STREAM";
}

function currentStation(state = store.getState()) {
  return state.stations.find((station) => station.id === state.player.stationId) || null;
}

function isOnAir(status) {
  return ["connecting", "playing", "buffering"].includes(status);
}

function createStationRow(station, index) {
  const row = document.createElement("section");
  row.className = "row";
  row.dataset.stationId = station.id;

  const tuneButton = document.createElement("button");
  tuneButton.type = "button";
  tuneButton.className = "row-main";
  tuneButton.dataset.action = "tune";
  tuneButton.dataset.stationId = station.id;
  tuneButton.setAttribute("aria-label", `Tune to ${station.name}`);

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");

  const indexLabel = document.createElement("span");
  indexLabel.className = "idx";
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} - FM`;

  const name = document.createElement("span");
  name.className = "name";
  if (station.name.length > 15) name.classList.add("long-name");
  name.textContent = station.name;

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = stationMeta(station);

  tuneButton.append(dot, indexLabel, name, meta);

  const editRowButton = document.createElement("button");
  editRowButton.type = "button";
  editRowButton.className = "edit-row-btn";
  editRowButton.dataset.action = "edit";
  editRowButton.dataset.stationId = station.id;
  editRowButton.textContent = "EDIT";
  editRowButton.setAttribute("aria-label", `Edit ${station.name}`);

  row.append(tuneButton, editRowButton);
  return row;
}

function renderStationList(state) {
  const fragment = document.createDocumentFragment();
  state.stations.forEach((station, index) => {
    fragment.appendChild(createStationRow(station, index));
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "add-row";
  addButton.dataset.action = "add";
  addButton.innerHTML = '<span class="add-mark" aria-hidden="true">+</span><span class="add-label">ADD FREQUENCY</span>';
  fragment.appendChild(addButton);

  list.replaceChildren(fragment);
  renderActiveStation(state);
}

function renderActiveStation(state) {
  for (const row of list.querySelectorAll(".row")) {
    const active = row.dataset.stationId === state.player.stationId && isOnAir(state.player.status);
    row.classList.toggle("active", active);
  }
}

function setPlayPauseIcon(playing) {
  playPauseIcon.className = playing ? "icon-pause" : "icon-play";
  playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function renderPlayer(state) {
  const station = currentStation(state);
  ticker.replaceChildren();
  document.body.classList.toggle("has-station", Boolean(station));
  playPauseBtn.disabled = !station;

  if (!station) {
    ticker.textContent = "TAP A FREQUENCY TO TUNE IN";
    setPlayPauseIcon(false);
    return;
  }

  const labels = {
    connecting: "CONNECTING",
    playing: "LIVE",
    paused: "PAUSED",
    buffering: "BUFFERING",
    error: "STREAM ERROR",
  };
  const stateLabel = document.createElement("b");
  stateLabel.textContent = `● ${labels[state.player.status] || state.player.status.toUpperCase()}`;
  const details = `  ${station.name}  -  ${stationMeta(station)}  ●  SIGNAL  ●  ${station.name}  -  ${stationMeta(station)}  ●`;
  ticker.append(stateLabel, document.createTextNode(details));
  setPlayPauseIcon(["playing", "buffering"].includes(state.player.status));
}

function renderUi(state) {
  document.body.classList.toggle("editing", state.ui.editing);
  editBtn.classList.toggle("active", state.ui.editing);
  editBtn.textContent = state.ui.editing ? "DONE" : "EDIT";
  editBtn.setAttribute("aria-label", state.ui.editing ? "Finish editing stations" : "Edit stations");

  const mode = state.ui.dialog.mode;
  const edit = mode === "edit";
  const manual = mode === "manual" || edit;
  searchSection.classList.toggle("hidden", manual);
  manualSection.classList.toggle("hidden", !manual);
  saveBtn.classList.toggle("hidden", !manual);
  deleteBtn.classList.toggle("hidden", !edit);
}

function setResultsHint(text) {
  searchResults.replaceChildren();
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = text;
  searchResults.appendChild(hint);
}

function resultMeta(result) {
  return [
    result.tags && result.tags.split(",")[0],
    result.countrycode || result.country,
    result.codec,
    result.bitrate ? `${result.bitrate}K` : null,
  ]
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}

function renderSearch(search) {
  if (search.status === "idle") {
    setResultsHint("Type at least 2 characters to search the radio-browser.info directory.");
    return;
  }
  if (search.status === "debouncing" || search.status === "loading") {
    setResultsHint("Searching...");
    return;
  }
  if (search.status === "error") {
    setResultsHint(search.error || "Search failed - check your connection.");
    return;
  }
  if (!search.results.length) {
    setResultsHint("No stations found.");
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const result of search.results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result";

    if (result.favicon) {
      const image = document.createElement("img");
      image.src = result.favicon;
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      button.appendChild(image);
    }

    const info = document.createElement("span");
    info.className = "r-info";
    const name = document.createElement("span");
    name.className = "r-name";
    name.textContent = result.name || "Unnamed station";
    const meta = document.createElement("span");
    meta.className = "r-meta";
    meta.textContent = resultMeta(result) || "INTERNET RADIO";
    info.append(name, meta);
    button.appendChild(info);
    button.addEventListener("click", () => addStationFromResult(result));
    fragment.appendChild(button);
  }
  searchResults.replaceChildren(fragment);
}

store.subscribe((state, previousState) => {
  if (state.stations !== previousState.stations) {
    saveStations(state.stations);
    renderStationList(state);
  }
  if (state.player !== previousState.player || state.stations !== previousState.stations) {
    renderPlayer(state);
    renderActiveStation(state);
  }
  if (state.ui !== previousState.ui) renderUi(state);
  if (state.search !== previousState.search) renderSearch(state.search);
});

async function playForSession(sessionId) {
  try {
    await audio.play();
  } catch (error) {
    store.dispatch({ type: "player/status-changed", status: "error", sessionId });
  }
}

function togglePlay(station) {
  const state = store.getState();
  if (station.id === state.player.stationId) {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    store.dispatch({ type: "player/play-requested" });
    playForSession(store.getState().player.sessionId);
    return;
  }

  if (!audio.paused) audio.pause();
  store.dispatch({ type: "player/selected", stationId: station.id });
  const sessionId = store.getState().player.sessionId;
  audio.src = station.url;
  audio.load();
  playForSession(sessionId);
}

function updateMediaSession(station) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: station.name,
    artist: "Live radio",
    ...(station.logo ? { artwork: [{ src: station.logo, sizes: "256x256" }] } : {}),
  });
}

function openDialogForAdd() {
  clearSearch();
  fieldName.value = "";
  fieldUrl.value = "";
  fieldSearch.value = "";
  dialogTitle.textContent = "ADD STATION";
  store.dispatch({ type: "search/reset" });
  store.dispatch({ type: "ui/dialog-opened", mode: "search" });
  stationDialog.showModal();
  fieldSearch.focus();
}

function openDialogForEdit(station) {
  clearSearch();
  fieldName.value = station.name;
  fieldUrl.value = station.url;
  dialogTitle.textContent = "EDIT STATION";
  store.dispatch({ type: "ui/dialog-opened", mode: "edit", stationId: station.id });
  stationDialog.showModal();
  fieldName.focus();
}

function closeDialog() {
  clearSearch();
  store.dispatch({ type: "ui/dialog-closed" });
  if (stationDialog.open) stationDialog.close();
}

function stopAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function createStationId() {
  return typeof crypto.randomUUID === "function"
    ? `st-${crypto.randomUUID()}`
    : `st-${Date.now().toString(36)}`;
}

function addStationFromResult(result) {
  const name = (result.name || "Unnamed station").trim();
  const url = typeof result.url_resolved === "string" ? result.url_resolved.trim() : "";
  if (!name || !url) return;

  store.dispatch({
    type: "station/added",
    station: {
      id: createStationId(),
      name,
      url,
      logo: result.favicon || null,
      meta: resultMeta(result) || "INTERNET RADIO / LIVE STREAM",
    },
  });
  closeDialog();
}

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !list.contains(button)) return;

  if (button.dataset.action === "add") {
    openDialogForAdd();
    return;
  }

  const station = store.getState().stations.find((item) => item.id === button.dataset.stationId);
  if (!station) return;
  if (button.dataset.action === "edit") openDialogForEdit(station);
  if (button.dataset.action === "tune") togglePlay(station);
});

editBtn.addEventListener("click", () => store.dispatch({ type: "ui/editing-toggled" }));

playPauseBtn.addEventListener("click", () => {
  const station = currentStation();
  if (station) togglePlay(station);
});

audio.addEventListener("playing", () => {
  const state = store.getState();
  store.dispatch({
    type: "player/status-changed",
    status: "playing",
    sessionId: state.player.sessionId,
  });
  const station = currentStation();
  if (station) updateMediaSession(station);
});

audio.addEventListener("pause", () => {
  const state = store.getState();
  if (!["playing", "buffering"].includes(state.player.status)) return;
  store.dispatch({
    type: "player/status-changed",
    status: "paused",
    sessionId: state.player.sessionId,
  });
});

audio.addEventListener("waiting", () => {
  const state = store.getState();
  if (!["connecting", "playing"].includes(state.player.status)) return;
  store.dispatch({
    type: "player/status-changed",
    status: "buffering",
    sessionId: state.player.sessionId,
  });
});

audio.addEventListener("error", () => {
  const state = store.getState();
  if (!state.player.stationId) return;
  store.dispatch({
    type: "player/status-changed",
    status: "error",
    sessionId: state.player.sessionId,
  });
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => {
    const station = currentStation();
    if (station && audio.paused) togglePlay(station);
  });
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
}

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (stationDialog.open) return;

  const target = event.target;
  const isEditingText =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;
  if (isEditingText) return;

  const station = currentStation();
  if (!station) return;
  event.preventDefault();
  togglePlay(station);
});

cancelBtn.addEventListener("click", closeDialog);
cancelBtn2.addEventListener("click", closeDialog);
stationDialog.addEventListener("close", () => {
  clearSearch();
  store.dispatch({ type: "ui/dialog-closed" });
});
manualBtn.addEventListener("click", () => {
  store.dispatch({ type: "ui/dialog-mode-changed", mode: "manual" });
  fieldName.focus();
});

deleteBtn.addEventListener("click", () => {
  const stationId = store.getState().ui.dialog.stationId;
  if (stationId === null) return;
  if (stationId === store.getState().player.stationId) stopAudio();
  store.dispatch({ type: "station/deleted", stationId });
  closeDialog();
});

stationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = fieldName.value.trim();
  const url = fieldUrl.value.trim();
  if (!name || !url) return;

  const stationId = store.getState().ui.dialog.stationId;
  if (stationId === null) {
    store.dispatch({
      type: "station/added",
      station: { id: createStationId(), name, url },
    });
  } else {
    store.dispatch({
      type: "station/updated",
      stationId,
      changes: { name, url },
    });
  }
  closeDialog();
});

let searchTimer = null;
let searchController = null;

function clearSearch() {
  clearTimeout(searchTimer);
  searchTimer = null;
  searchController?.abort();
  searchController = null;
}

fieldSearch.addEventListener("input", () => {
  clearSearch();
  const query = fieldSearch.value.trim();
  store.dispatch({ type: "search/query-changed", query });
  if (query.length < 2) return;

  const requestId = store.getState().search.requestId;
  searchTimer = setTimeout(() => doSearch(query, requestId), 400);
});

async function doSearch(query, requestId) {
  const search = store.getState().search;
  if (search.query !== query || search.requestId !== requestId) return;

  const controller = new AbortController();
  searchController = controller;
  store.dispatch({ type: "search/started", query, requestId });

  try {
    const url = `${RB_BASE}/json/stations/search?name=${encodeURIComponent(query)}&limit=8&hidebroken=true&order=votes&reverse=true`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error("Invalid search response");
    store.dispatch({ type: "search/succeeded", requestId, results });
  } catch (error) {
    if (error.name === "AbortError") return;
    store.dispatch({
      type: "search/failed",
      requestId,
      error: "Search failed - check your connection.",
    });
  } finally {
    if (searchController === controller) searchController = null;
  }
}

function updateClock() {
  clock.textContent = new Date().toLocaleTimeString("en-GB");
}

renderStationList(store.getState());
renderPlayer(store.getState());
renderUi(store.getState());
renderSearch(store.getState().search);
updateClock();
setInterval(updateClock, 1000);
