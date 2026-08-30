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

const STORAGE_KEY = "webradio.stations.v1";

function loadStations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    // Corrupted storage is handled by restoring the defaults below.
  }
  return null;
}

function saveStations(stationList) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stationList));
}

let stations = loadStations();
if (stations === null) {
  stations = DEFAULT_STATIONS.map((station) => ({ ...station }));
  saveStations(stations);
} else {
  let migrated = false;
  for (const stationDefault of DEFAULT_STATIONS) {
    const station = stations.find((item) => item.id === stationDefault.id);
    if (!station) continue;
    for (const property of ["logo", "meta"]) {
      if (!station[property] && stationDefault[property]) {
        station[property] = stationDefault[property];
        migrated = true;
      }
    }
  }
  if (migrated) saveStations(stations);
}

let currentStationId = null;
let playbackState = "idle";
let editing = false;

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

function isOnAir() {
  return ["connecting", "playing", "buffering"].includes(playbackState);
}

function render() {
  list.replaceChildren();

  stations.forEach((station, index) => {
    const row = document.createElement("section");
    row.className = "row" + (station.id === currentStationId && isOnAir() ? " active" : "");

    const tuneButton = document.createElement("button");
    tuneButton.type = "button";
    tuneButton.className = "row-main";
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
    tuneButton.addEventListener("click", () => togglePlay(station));

    const editRowButton = document.createElement("button");
    editRowButton.type = "button";
    editRowButton.className = "edit-row-btn";
    editRowButton.textContent = "EDIT";
    editRowButton.setAttribute("aria-label", `Edit ${station.name}`);
    editRowButton.addEventListener("click", () => openDialogForEdit(station));

    row.append(tuneButton, editRowButton);
    list.appendChild(row);
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "add-row";
  addButton.innerHTML = '<span class="add-mark" aria-hidden="true">+</span><span class="add-label">ADD FREQUENCY</span>';
  addButton.addEventListener("click", openDialogForAdd);
  list.appendChild(addButton);
}

function currentStation() {
  return stations.find((station) => station.id === currentStationId) || null;
}

function updateTicker(station, state) {
  ticker.replaceChildren();
  document.body.classList.toggle("has-station", Boolean(station));

  if (!station) {
    ticker.textContent = "TAP A FREQUENCY TO TUNE IN";
    return;
  }

  const stateLabel = document.createElement("b");
  stateLabel.textContent = `● ${state.toUpperCase()}`;
  const details = `  ${station.name}  -  ${stationMeta(station)}  ●  SIGNAL  ●  ${station.name}  -  ${stationMeta(station)}  ●`;
  ticker.append(stateLabel, document.createTextNode(details));
}

function setPlaybackState(state) {
  playbackState = state;
  const station = currentStation();
  const labels = {
    connecting: "CONNECTING",
    playing: "LIVE",
    paused: "PAUSED",
    buffering: "BUFFERING",
    error: "STREAM ERROR",
  };
  updateTicker(station, labels[state] || state);
  setPlayPauseIcon(state === "playing" || state === "buffering");
  render();
}

function setPlayPauseIcon(playing) {
  playPauseIcon.className = playing ? "icon-pause" : "icon-play";
  playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

async function togglePlay(station) {
  if (station.id === currentStationId) {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPlaybackState("connecting");
    try {
      await audio.play();
    } catch (error) {
      setPlaybackState("error");
    }
    return;
  }

  currentStationId = station.id;
  playPauseBtn.disabled = false;
  audio.src = station.url;
  audio.load();
  setPlaybackState("connecting");
  try {
    await audio.play();
  } catch (error) {
    setPlaybackState("error");
  }
}

audio.addEventListener("playing", () => {
  const station = currentStation();
  setPlaybackState("playing");
  if (station) updateMediaSession(station);
});

audio.addEventListener("pause", () => {
  if (currentStationId) setPlaybackState("paused");
});

audio.addEventListener("waiting", () => {
  if (currentStationId) setPlaybackState("buffering");
});

audio.addEventListener("error", () => {
  if (currentStationId) setPlaybackState("error");
});

playPauseBtn.addEventListener("click", () => {
  const station = currentStation();
  if (station) togglePlay(station);
});

function updateMediaSession(station) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: station.name,
    artist: "Live radio",
    ...(station.logo ? { artwork: [{ src: station.logo, sizes: "256x256" }] } : {}),
  });
  navigator.mediaSession.setActionHandler("play", () => audio.play().catch(() => {}));
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
}

editBtn.addEventListener("click", () => {
  editing = !editing;
  document.body.classList.toggle("editing", editing);
  editBtn.classList.toggle("active", editing);
  editBtn.textContent = editing ? "DONE" : "EDIT";
  editBtn.setAttribute("aria-label", editing ? "Finish editing stations" : "Edit stations");
});

let dialogStationId = null;
let manualMode = false;

function updateDialogMode() {
  const edit = dialogStationId !== null;
  searchSection.classList.toggle("hidden", edit || manualMode);
  manualSection.classList.toggle("hidden", !edit && !manualMode);
  saveBtn.classList.toggle("hidden", !edit && !manualMode);
}

function openDialogForAdd() {
  dialogStationId = null;
  manualMode = false;
  dialogTitle.textContent = "ADD STATION";
  fieldName.value = "";
  fieldUrl.value = "";
  fieldSearch.value = "";
  setResultsHint("Type at least 2 characters to search the radio-browser.info directory.");
  deleteBtn.classList.add("hidden");
  updateDialogMode();
  stationDialog.showModal();
  fieldSearch.focus();
}

function openDialogForEdit(station) {
  dialogStationId = station.id;
  manualMode = true;
  dialogTitle.textContent = "EDIT STATION";
  fieldName.value = station.name;
  fieldUrl.value = station.url;
  deleteBtn.classList.remove("hidden");
  updateDialogMode();
  stationDialog.showModal();
  fieldName.focus();
}

cancelBtn.addEventListener("click", () => stationDialog.close());
cancelBtn2.addEventListener("click", () => stationDialog.close());
manualBtn.addEventListener("click", () => {
  manualMode = true;
  updateDialogMode();
  fieldName.focus();
});

deleteBtn.addEventListener("click", () => {
  if (dialogStationId === null) return;
  const wasCurrent = dialogStationId === currentStationId;
  stations = stations.filter((station) => station.id !== dialogStationId);
  saveStations(stations);

  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    currentStationId = null;
    playbackState = "idle";
    playPauseBtn.disabled = true;
    setPlayPauseIcon(false);
    updateTicker(null, "");
  }

  stationDialog.close();
  render();
});

stationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = {
    name: fieldName.value.trim(),
    url: fieldUrl.value.trim(),
  };
  if (!data.name || !data.url) return;

  if (dialogStationId === null) {
    stations.push({ id: "st-" + Date.now().toString(36), ...data });
  } else {
    const station = stations.find((item) => item.id === dialogStationId);
    if (station) Object.assign(station, data);
  }
  saveStations(stations);
  stationDialog.close();
  render();
});

const RB_BASE = "https://de1.api.radio-browser.info";
let searchTimer = null;
let searchSeq = 0;

function setResultsHint(text) {
  searchResults.replaceChildren();
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = text;
  searchResults.appendChild(hint);
}

fieldSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = fieldSearch.value.trim();
  if (query.length < 2) {
    setResultsHint("Type at least 2 characters to search the radio-browser.info directory.");
    return;
  }
  searchTimer = setTimeout(() => doSearch(query), 400);
});

async function doSearch(query) {
  const seq = ++searchSeq;
  setResultsHint("Searching...");
  try {
    const url = `${RB_BASE}/json/stations/search?name=${encodeURIComponent(query)}&limit=8&hidebroken=true&order=votes&reverse=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const results = await response.json();
    if (seq === searchSeq) renderResults(results);
  } catch (error) {
    if (seq === searchSeq) setResultsHint("Search failed - check your connection.");
  }
}

function resultMeta(result) {
  return [result.tags && result.tags.split(",")[0], result.countrycode || result.country, result.codec, result.bitrate ? `${result.bitrate}K` : null]
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}

function renderResults(results) {
  searchResults.replaceChildren();
  if (!results.length) {
    setResultsHint("No stations found.");
    return;
  }

  for (const result of results) {
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
    searchResults.appendChild(button);
  }
}

function addStationFromResult(result) {
  stations.push({
    id: "st-" + Date.now().toString(36),
    name: (result.name || "Unnamed station").trim(),
    url: result.url_resolved,
    logo: result.favicon || null,
    meta: resultMeta(result) || "INTERNET RADIO / LIVE STREAM",
  });
  saveStations(stations);
  stationDialog.close();
  render();
}

function updateClock() {
  clock.textContent = new Date().toLocaleTimeString("en-GB");
}

updateClock();
setInterval(updateClock, 1000);
updateTicker(null, "");
setPlayPauseIcon(false);
render();
