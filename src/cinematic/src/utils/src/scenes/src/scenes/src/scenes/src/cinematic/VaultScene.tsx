import React from "react";
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
  const handleScannerClick = () => {
    // play success animation by swapping src or using state in a later ticket
    dispatch({ type: "SCANNER_CONFIRMED" });
    onComplete();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#02040a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Vault background (static image) */}
      <img
        src="/assets/img/vault_bg.png"
        alt="Vault"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.9,
        }}
      />

      {/* Fog layer */}
      <LottiePlayer
        src="/assets/lottie/fog_idle.json"
        loop
        autoplay
        className="vault-fog"
      />

      {/* Vault door */}
      <div
        style={{
          position: "relative",
          width: 480,
          maxWidth: "80vw",
        }}
      >
        <LottiePlayer
          src="/assets/lottie/vault_door_open.json"
          autoplay
          loop={false}
        />
      </div>

      {/* Scanner */}
      <button
        onClick={handleScannerClick}
        style={{
          position: "absolute",
          bottom: "15%",
          padding: "12px 24px",
          borderRadius: 999,
          border: "1px solid rgba(0,255,255,0.4)",
          background: "rgba(0,0,0,0.7)",
          color: "#e0ffff",
          cursor: "pointer",
        }}
      >
        Authenticate
      </button>
    </div>
  );
};
