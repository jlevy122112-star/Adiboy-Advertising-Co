import { preloadAssets } from "../utils/assetPreloader";

export const CinematicEngine: React.FC = () => {
  const [machine, setMachine] = useState<CinematicMachine>(initialMachine);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    preloadAssets()
      .then(() => {
        if (mounted) setAssetsReady(true);
      })
      .catch((err) => {
        console.error("[ASSETS] Preload failed", err);
        if (mounted) setAssetsReady(true); // fail-open for now
      });
    return () => {
      mounted = false;
      timingEngine.clearAll();
    };
  }, []);

  const dispatch = useCallback((event: CinematicEvent) => {
    setMachine((prev) => transition(prev, event));
  }, []);

  const startGeneration = useCallback(() => {
    if (!assetsReady) return;
    dispatch({ type: "START_GENERATION" });
  }, [dispatch, assetsReady]);

  // ...rest unchanged...

  if (!assetsReady) {
    return (
      <div style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
        <p style={{ padding: 24 }}>[ASSETS] Loading…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {renderScene()}
    </div>
  );
};

import React, { useCallback, useEffect, useState } from "react";
import {
  initialMachine,
  transition,
  CinematicMachine,
  CinematicEvent,
} from "./stateMachine";
import { timingEngine } from "../utils/timingEngine";
import { VaultScene } from "../scenes/VaultScene";
import { ReactorScene } from "../scenes/ReactorScene";
import { PresentationScene } from "../scenes/PresentationScene";

export const CinematicEngine: React.FC = () => {
  const [machine, setMachine] = useState<CinematicMachine>(initialMachine);

  const dispatch = useCallback((event: CinematicEvent) => {
    setMachine((prev) => transition(prev, event));
  }, []);

  const startGeneration = useCallback(() => {
    dispatch({ type: "START_GENERATION" });
  }, [dispatch]);

  // Dummy pipeline timing for Ticket #1
  useEffect(() => {
    timingEngine.clearAll();

    if (machine.state === "vault_intro") {
      timingEngine.schedule(() => {
        dispatch({ type: "SCANNER_CONFIRMED" });
      }, 600);
    }

    if (machine.state === "reactor_ready") {
      timingEngine.schedule(() => {
        dispatch({ type: "SWITCHES_COMPLETED" });
        dispatch({ type: "LEVER_PULLED" });
      }, 900);
    }

    if (machine.state === "transition_to_presentation") {
      timingEngine.schedule(() => {
        dispatch({ type: "PRESENTATION_COMPLETE" });
        dispatch({ type: "BACKEND_DONE" });
      }, 1200);
    }

    return () => {
      timingEngine.clearAll();
    };
  }, [machine.state, dispatch]);

  const renderScene = () => {
    switch (machine.state) {
      case "vault_intro":
        return (
          <VaultScene
            state={machine.state}
            dispatch={dispatch}
            onComplete={() => {}}
          />
        );
      case "reactor_ready":
      case "reactor_running":
        return (
          <ReactorScene
            state={machine.state}
            dispatch={dispatch}
            onComplete={() => {}}
          />
        );
      case "transition_to_presentation":
      case "presentation_reveal":
      case "artifacts_ready":
        return (
          <PresentationScene
            state={machine.state}
            dispatch={dispatch}
            onComplete={() => {}}
          />
        );
      default:
        return (
          <div style={{ color: "#fff", padding: 24 }}>
            <h2>Idle</h2>
            <button onClick={startGeneration}>Start Generation</button>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {renderScene()}
    </div>
  );
};
