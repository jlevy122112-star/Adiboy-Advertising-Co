import React, { useState, useEffect } from "react";
import { LottiePlayer } from "../components/animations/LottiePlayer";

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
  const [slamDone, setSlamDone] = useState(false);
  const [stampDone, setStampDone] = useState(false);

 const artifacts = (state === "artifacts_ready" && (dispatch as any).lastArtifacts)
  ? (dispatch as any).lastArtifacts
  : [];


  useEffect(() => {
    // When slam + stamp are done, notify cinematic engine
    if (slamDone && stampDone) {
      dispatch({ type: "PRESENTATION_COMPLETE" });
      onComplete();
    }
  }, [slamDone, stampDone, dispatch, onComplete]);

  const handleArtifactClick = (artifact: any) => {
    dispatch({ type: "ARTIFACT_SELECTED", payload: artifact });
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
      {/* Fog Burst */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.7 }}>
        <LottiePlayer
          src="/assets/lottie/fog_burst.json"
          autoplay
          loop={false}
        />
      </div>

      {/* Briefcase Slam */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          width: 420,
          zIndex: 2,
        }}
      >
        <LottiePlayer
          src="/assets/lottie/briefcase_slam.json"
          autoplay
          loop={false}
          onComplete={() => setSlamDone(true)}
        />
      </div>

      {/* Stamp */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          width: 260,
          opacity: slamDone ? 1 : 0,
          transition: "opacity 0.4s ease",
          zIndex: 3,
        }}
      >
        {slamDone && (
          <LottiePlayer
            src="/assets/lottie/stamp_declas.json"
            autoplay
            loop={false}
            onComplete={() => setStampDone(true)}
          />
        )}
      </div>

      {/* Artifact Cards */}
      {stampDone && (
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            display: "flex",
            gap: 24,
            zIndex: 4,
          }}
        >
          {artifacts.map((a) => (
            <div
              key={a.id}
              onClick={() => handleArtifactClick(a)}
              style={{
                width: 180,
                height: 140,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 18,
                transition: "all 0.25s ease",
              }}
            >
              {a.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

