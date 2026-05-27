import React from "react";

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
  return (
    <div style={{ color: "#fff", padding: 24 }}>
      <h2>Reactor Scene (placeholder)</h2>
      <p>State: {state}</p>
      <button
        onClick={() => {
          dispatch({ type: "SWITCHES_COMPLETED" });
          dispatch({ type: "LEVER_PULLED" });
          onComplete();
        }}
      >
        Simulate Reactor Complete
      </button>
    </div>
  );
};
