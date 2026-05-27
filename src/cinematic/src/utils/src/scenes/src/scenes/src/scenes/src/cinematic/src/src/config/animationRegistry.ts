export type AnimationKey =
  | "vaultDoorOpen"
  | "scannerIdle"
  | "scannerSuccess"
  | "fogIdle"
  | "reactorPulse"
  | "briefcaseSlam"
  | "fogBurst"
  | "stampDeclas";

export const animationRegistry: Record<AnimationKey, string> = {
  vaultDoorOpen: "vault_door_open.json",
  scannerIdle: "scanner_idle.json",
  scannerSuccess: "scanner_success.json",
  fogIdle: "fog_idle.json",
  reactorPulse: "reactor_pulse.json",
  briefcaseSlam: "briefcase_slam.json",
  fogBurst: "fog_burst.json",
  stampDeclas: "stamp_declas.json",
};
