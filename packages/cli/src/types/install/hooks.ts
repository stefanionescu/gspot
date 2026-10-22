/** Hook readiness and a readable status. */
export type HookStatus = { ready: boolean; text: string };

/** The Git setting to write, or instructions for hooks that the repository already owns. */
export type HookPlan = { command?: readonly string[]; note: string };
