import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState, createStore, reducer } from "../state.mjs";

const stations = [
  { id: "one", name: "One", url: "https://example.com/one" },
  { id: "two", name: "Two", url: "https://example.com/two" },
];

function initialState() {
  return createInitialState(stations.map((station) => ({ ...station })));
}

test("selecting a station starts a new playback session", () => {
  const selected = reducer(initialState(), { type: "player/selected", stationId: "one" });
  assert.deepEqual(selected.player, {
    stationId: "one",
    status: "connecting",
    sessionId: 1,
  });
});

test("stale playback results cannot overwrite the current session", () => {
  let state = reducer(initialState(), { type: "player/selected", stationId: "one" });
  const oldSessionId = state.player.sessionId;
  state = reducer(state, { type: "player/selected", stationId: "two" });
  state = reducer(state, {
    type: "player/status-changed",
    status: "error",
    sessionId: oldSessionId,
  });

  assert.equal(state.player.stationId, "two");
  assert.equal(state.player.status, "connecting");
});

test("deleting the selected station resets playback atomically", () => {
  let state = reducer(initialState(), { type: "player/selected", stationId: "one" });
  const sessionId = state.player.sessionId;
  state = reducer(state, { type: "station/deleted", stationId: "one" });

  assert.deepEqual(state.stations.map((station) => station.id), ["two"]);
  assert.equal(state.player.stationId, null);
  assert.equal(state.player.status, "idle");
  assert.equal(state.player.sessionId, sessionId + 1);
});

test("station updates preserve metadata and do not mutate the previous state", () => {
  const state = initialState();
  state.stations[0].logo = "logo.png";
  const updated = reducer(state, {
    type: "station/updated",
    stationId: "one",
    changes: { name: "New name", url: "https://example.com/new" },
  });

  assert.equal(state.stations[0].name, "One");
  assert.equal(updated.stations[0].name, "New name");
  assert.equal(updated.stations[0].logo, "logo.png");
});

test("stale search responses cannot replace newer search state", () => {
  let state = reducer(initialState(), { type: "search/query-changed", query: "jazz" });
  const oldRequestId = state.search.requestId;
  state = reducer(state, { type: "search/query-changed", query: "news" });
  state = reducer(state, {
    type: "search/succeeded",
    requestId: oldRequestId,
    results: [{ name: "Stale result" }],
  });

  assert.equal(state.search.query, "news");
  assert.deepEqual(state.search.results, []);
});

test("the store only notifies subscribers when state changes", () => {
  const store = createStore(reducer, initialState());
  let notifications = 0;
  store.subscribe(() => notifications++);

  store.dispatch({ type: "unknown" });
  store.dispatch({ type: "player/selected", stationId: "missing" });
  assert.equal(notifications, 0);

  store.dispatch({ type: "player/selected", stationId: "one" });
  assert.equal(notifications, 1);
});
