import type { PlannedCheck } from '#cli/types/execution/runtime.ts';

/** A planned Vulture invocation and the private environment that locates it. */
export type PreparedVulture = { planned: PlannedCheck; env: Record<string, string> };
