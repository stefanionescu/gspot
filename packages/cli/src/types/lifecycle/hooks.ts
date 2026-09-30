// The types of lifecycle/hooks in this package.
import type { Root } from '#cli/types/platform.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';
import type { Owner, Planned, OwnershipEntry } from '#cli/types/lifecycle/lifecycle.ts';

export type Readiness = (root: string, runner: string | undefined) => boolean;
export type Status = {
    policy: Policy;
    root: string;
    location: HookLocation;
    entries: OwnershipEntry[];
    hasNativeHooks: boolean;
    husky: Map<string, string> | undefined;
};
/** A native hook manager gspot integrates with. */
export type HookTool = 'simple-git-hooks' | 'pre-commit' | 'lefthook' | 'husky';
/** The prepared Git directory a manager generated its hooks into, and what the generation needs. */
export type Preparation = {
    hookTool: HookTool;
    policy: Policy;
    root: string;
    executable: string;
    installedConfig: string;
    work: string;
    files: Root;
};
/** What one manager's dispatcher needs: the lines around the native run, the run itself, and what follows it. */
export type Dispatch = {
    tool: HookTool;
    /** Lines before the work directory: presence checks and the manager's own exports. */
    preamble: string[];
    /** Lines after the exports: the configuration checks the manager needs before it runs. */
    checks: string[];
    /** The command that runs the manager's hook with the Git arguments; the dispatcher adds the push input. */
    native: string;
    /** The exit statuses that mean the manager or its runtime is missing. */
    unavailable: string[];
    unavailableNote?: string;
    /** Whether the manager's hook must run gspot, so silence is an error. */
    isRunRequired: boolean;
    /** The command that runs gspot when the manager's hook did not, or undefined when the hook then exits clean. */
    direct: string | undefined;
};
/** A hook a native manager generated, and the text gspot installs in its place. */
export type PreparedHook = { generated: string; installed: string };
export type Installation = {
    owner: Owner;
    location: HookLocation;
    policy: Policy;
    nativeHooks: ReadonlyMap<string, PreparedHook> | undefined;
    recorded: Set<string>;
    nativeMarker: string | undefined;
    directory: string;
};
export type Restorations = { plans: Planned[]; preserved: string[] };
