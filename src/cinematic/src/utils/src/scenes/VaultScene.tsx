import React from "react";

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
  // For now: simple placeholder + manual trigger
  return (
    <div style={{ color: "#fff", padding: 24 }}>
      <h2>Vault Scene (placeholder)</h2>
      <p>State: {state}</p>
      <button
        onClick={() => {
          dispatch({ type: "SCANNER_CONFIRMED" });
          onComplete();
        }}
      >
        Simulate Scanner Confirmed
      </button>
    </div>
  );
};
