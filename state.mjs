const PLAYBACK_STATUSES = new Set([
  "idle",
  "connecting",
  "playing",
  "paused",
  "buffering",
  "error",
]);

export function createInitialState(stations) {
  return {
    stations,
    player: {
      stationId: null,
      status: "idle",
      sessionId: 0,
    },
    ui: {
      editing: false,
      dialog: {
        mode: "closed",
        stationId: null,
      },
    },
    search: {
      query: "",
      status: "idle",
      results: [],
      error: null,
      requestId: 0,
    },
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case "station/added":
      return {
        ...state,
        stations: [...state.stations, action.station],
      };

    case "station/updated": {
      let changed = false;
      const stations = state.stations.map((station) => {
        if (station.id !== action.stationId) return station;
        changed = true;
        return { ...station, ...action.changes, id: station.id };
      });
      return changed ? { ...state, stations } : state;
    }

    case "station/deleted": {
      if (!state.stations.some((station) => station.id === action.stationId)) return state;
      const deletingCurrent = state.player.stationId === action.stationId;
      return {
        ...state,
        stations: state.stations.filter((station) => station.id !== action.stationId),
        player: deletingCurrent
          ? {
              stationId: null,
              status: "idle",
              sessionId: state.player.sessionId + 1,
            }
          : state.player,
      };
    }

    case "player/selected": {
      if (!state.stations.some((station) => station.id === action.stationId)) return state;
      return {
        ...state,
        player: {
          stationId: action.stationId,
          status: "connecting",
          sessionId: state.player.sessionId + 1,
        },
      };
    }

    case "player/play-requested":
      if (state.player.stationId === null) return state;
      return {
        ...state,
        player: {
          ...state.player,
          status: "connecting",
          sessionId: state.player.sessionId + 1,
        },
      };

    case "player/status-changed":
      if (
        action.sessionId !== state.player.sessionId ||
        state.player.stationId === null ||
        !PLAYBACK_STATUSES.has(action.status) ||
        action.status === "idle"
      ) {
        return state;
      }
      if (action.status === state.player.status) return state;
      return {
        ...state,
        player: { ...state.player, status: action.status },
      };

    case "ui/editing-toggled":
      return {
        ...state,
        ui: { ...state.ui, editing: !state.ui.editing },
      };

    case "ui/dialog-opened":
      return {
        ...state,
        ui: {
          ...state.ui,
          dialog: {
            mode: action.mode,
            stationId: action.stationId ?? null,
          },
        },
      };

    case "ui/dialog-mode-changed":
      if (state.ui.dialog.mode === "closed") return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          dialog: { ...state.ui.dialog, mode: action.mode },
        },
      };

    case "ui/dialog-closed":
      if (state.ui.dialog.mode === "closed") return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          dialog: { mode: "closed", stationId: null },
        },
      };

    case "search/reset":
      return {
        ...state,
        search: {
          query: "",
          status: "idle",
          results: [],
          error: null,
          requestId: state.search.requestId + 1,
        },
      };

    case "search/query-changed":
      return {
        ...state,
        search: {
          query: action.query,
          status: action.query.length >= 2 ? "debouncing" : "idle",
          results: [],
          error: null,
          requestId: state.search.requestId + 1,
        },
      };

    case "search/started":
      if (action.requestId !== state.search.requestId || action.query !== state.search.query) return state;
      return {
        ...state,
        search: { ...state.search, status: "loading", error: null },
      };

    case "search/succeeded":
      if (action.requestId !== state.search.requestId) return state;
      return {
        ...state,
        search: {
          ...state.search,
          status: "success",
          results: action.results,
          error: null,
        },
      };

    case "search/failed":
      if (action.requestId !== state.search.requestId) return state;
      return {
        ...state,
        search: {
          ...state.search,
          status: "error",
          results: [],
          error: action.error,
        },
      };

    default:
      return state;
  }
}

export function createStore(reducerFunction, initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      const previousState = state;
      const nextState = reducerFunction(previousState, action);
      if (nextState === previousState) return action;

      state = nextState;
      for (const listener of listeners) listener(state, previousState, action);
      return action;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
