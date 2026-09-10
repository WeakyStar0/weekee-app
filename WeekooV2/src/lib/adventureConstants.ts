// Shared across every step of an /adventure session (mining prompts, fight/flee
// choice, in-battle attack/defend) — any single inactivity anywhere ends the
// whole adventure. Kept in one place so every collector agrees.
export const ADVENTURE_TIMEOUT_MS = 45_000;
