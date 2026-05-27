import React from "react";

interface PresentationSceneProps {
  state: string;
  dispatch: (event: { type: string; payload?: any }) => void;
  onComplete: () => void;
}

export const PresentationScene: React.FC<PresentationSceneProps> = ({
  state,
  dispatch,
  onComplete,
}) => {
  return (
    <div style={{ color: "#fff", padding: 24 }}>
      <h2>Presentation Scene (placeholder)</h2>
      <p>State: {state}</p>
      <button
        onClick={() => {
          dispatch({ type: "PRESENTATION_COMPLETE" });
          dispatch({ type: "BACKEND_DONE" });
          onComplete();
        }}
      >
        Simulate Presentation Complete
      </button>
    </div>
  );
};
