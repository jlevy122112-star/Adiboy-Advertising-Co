import React, { useState } from "react";
import { LottiePlayer } from "../components/animations/LottiePlayer";

interface VaultSceneProps {
  state: string;
  dispatch: (event: { type: string; payload?: any }) => void;
  onComplete: () => void;
}

export const VaultScene: React.FC<VaultSceneProps> = ({
  state,
  dispatch,
  onComplete,
}) => {
  const [scannerState, setScannerState] = useState<"idle" | "success">("idle");

  const handleScannerClick = () => {
    setScannerState("success");

    // Trigger cinematic state machine
    dispatch({ type: "SCANNER_CONFIRMED" });

    // Allow the scene to finish its animation
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background */}
      <img
        src="/assets/img/vault_bg.png"
        alt="Vault Background"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.85,
        }}
      />

      {/* Fog */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.6 }}>
        <LottiePlayer
          src="/assets/lottie/fog_idle.json"
          autoplay
          loop
        />
      </div>

      {/* Vault Door */}
      <div
        style={{
          position: "relative",
          width: 480,
          maxWidth: "80vw",
          zIndex: 2,
        }}
      >
        <LottiePlayer
          src="/assets/lottie/vault_door_open.json"
          autoplay
          loop={false}
        />
      </div>

      {/* Scanner Button */}
      <button
        onClick={handleScannerClick}
        style={{
          position: "absolute",
          bottom: "12%",
          padding: "14px 32px",
          borderRadius: 999,
          border: "1px solid rgba(0,255,255,0.5)",
          background:
            scannerState === "idle"
              ? "rgba(0,0,0,0.6)"
              : "rgba(0,255,120,0.25)",
          color: scannerState === "idle" ? "#bff" : "#0f0",
          fontSize: 18,
          cursor: "pointer",
          zIndex: 3,
          transition: "all 0.25s ease",
        }}
      >
        {scannerState === "idle" ? "Authenticate" : "Access Granted"}
      </button>

      {/* Scanner Animation */}
      <div style={{ position: "absolute", bottom: "22%", zIndex: 3 }}>
        <LottiePlayer
          src={
            scannerState === "idle"
              ? "/assets/lottie/scanner_idle.json"
              : "/assets/lottie/scanner_success.json"
          }
          autoplay
          loop={scannerState === "idle"}
        />
      </div>
    </div>
  );
};
