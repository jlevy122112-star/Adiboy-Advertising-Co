export type CinematicState =
  | "idle"
  | "vault_intro"
  | "reactor_ready"
  | "reactor_running"
  | "transition_to_presentation"
  | "presentation_reveal"
  | "artifacts_ready"
  | "viewing_artifact"
  | "error";

export type CinematicEventType =
  | "START_GENERATION"
  | "SCANNER_CONFIRMED"
  | "SWITCHES_COMPLETED"
  | "LEVER_PULLED"
  | "BACKEND_DONE"
  | "PRESENTATION_COMPLETE"
  | "ARTIFACT_SELECTED"
  | "GENERATION_FAILED"
  | "RESET";

export interface CinematicEvent {
  type: CinematicEventType;
  payload?: any;
}

export interface CinematicContext {
  error?: string;
}

export interface CinematicMachine {
  state: CinematicState;
  context: CinematicContext;
}

export const initialMachine: CinematicMachine = {
  state: "idle",
  context: {},
};

export function transition(
  machine: CinematicMachine,
  event: CinematicEvent
): CinematicMachine {
  const prevState = machine.state;
  let nextState: CinematicState = prevState;
  const context = { ...machine.context };

  switch (prevState) {
    case "idle":
      if (event.type === "START_GENERATION") nextState = "vault_intro";
      break;

    case "vault_intro":
      if (event.type === "SCANNER_CONFIRMED") nextState = "reactor_ready";
      break;

    case "reactor_ready":
      if (event.type === "SWITCHES_COMPLETED") nextState = "reactor_running";
      break;

    case "reactor_running":
      if (event.type === "LEVER_PULLED")
        nextState = "transition_to_presentation";
      break;

    case "transition_to_presentation":
      if (event.type === "PRESENTATION_COMPLETE")
        nextState = "presentation_reveal";
      break;

    case "presentation_reveal":
      if (event.type === "BACKEND_DONE") nextState = "artifacts_ready";
      if (event.type === "ARTIFACT_SELECTED") nextState = "viewing_artifact";
      break;

    case "viewing_artifact":
      if (event.type === "RESET") nextState = "idle";
      break;
  }

  if (event.type === "GENERATION_FAILED") {
    nextState = "error";
    context.error = event.payload?.message ?? "Unknown error";
  }
  if (event.type === "RESET") {
    nextState = "idle";
  }

  if (prevState !== nextState) {
    console.log(
      `[CINEMATIC] Transition: ${prevState} → ${nextState} via ${event.type}`
    );
  }

  return { state: nextState, context };
}
