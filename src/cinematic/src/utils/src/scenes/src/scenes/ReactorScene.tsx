import React, { useState } from "react";
import { LottiePlayer } from "../components/animations/LottiePlayer";

interface ReactorSceneProps {
  state: string;
  dispatch: (event: { type: string; payload?: any }) => void;
  onComplete: () => void;
}

export const ReactorScene: React.FC<ReactorSceneProps> = ({
  state,
  dispatch,
  onComplete,
}) => {
  const [switches, setSwitches] = useState([false, false, false]);
  const [leverUnlocked, setLeverUnlocked] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);

  const toggleSwitch = (index: number) => {
    if (leverPulled) return;

    const updated = [...switches];
    updated[index] = true;
    setSwitches(updated);

    // When all 3 switches are flipped
    if (updated.every((s) => s)) {
      dispatch({ type: "SWITCHES_COMPLETED" });
      setLeverUnlocked(true);
    }
  };

  const pullLever = () => {
    if (!leverUnlocked || leverPulled) return;

    setLeverPulled(true);
    dispatch({ type: "LEVER_PULLED" });

    // Reactor pulse animation time
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#000814",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Fog */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <LottiePlayer src="/assets/lottie/fog_idle.json" autoplay loop />
      </div>

      {/* Reactor Core */}
      <div style={{ position: "absolute", top: "10%", width: 420 }}>
        <LottiePlayer
          src="/assets/lottie/reactor_pulse.json"
          autoplay={leverPulled}
          loop={false}
        />
      </div>

      {/* Switch Panel */}
      <div
        style={{
          position: "absolute",
          bottom: "25%",
          display: "flex",
          gap: 40,
        }}
      >
        {switches.map((active, i) => (
          <div
            key={i}
            onClick={() => toggleSwitch(i)}
            style={{
              width: 80,
              height: 140,
              background: active
                ? "rgba(0,255,120,0.3)"
                : "rgba(0,255,255,0.15)",
              border: "2px solid rgba(0,255,255,0.4)",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
          >
            <LottiePlayer
              src="/assets/lottie/switch_toggle.json"
              autoplay={active}
              loop={false}
            />
          </div>
        ))}
      </div>

      {/* Lever */}
      <div
        onClick={pullLever}
        style={{
          position: "absolute",
          bottom: "10%",
          width: 160,
          height: 160,
          cursor: leverUnlocked ? "pointer" : "not-allowed",
          opacity: leverUnlocked ? 1 : 0.4,
          transition: "opacity 0.3s ease",
        }}
      >
        <LottiePlayer
          src="/assets/lottie/lever_pull.json"
          autoplay={leverPulled}
          loop={false}
        />
      </div>
    </div>
  );
};
