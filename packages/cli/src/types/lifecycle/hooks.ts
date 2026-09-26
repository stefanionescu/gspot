// The types of lifecycle/hooks in this package.
import type { Policy } from '#cli/types/policy/policy.ts';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';
import type { FileProposal, LifecycleOwner, OwnershipEntry } from '#cli/types/lifecycle/lifecycle.ts';

export type Readiness = (root: string, runner: string | undefined, binary: string | undefined) => boolean;
export type Status = {
    policy: Policy;
    root: string;
    location: HookLocation;
    entries: OwnershipEntry[];
    hasManager: boolean;
    husky: Map<string, string> | undefined;
};
/** A native hook manager gspot integrates with. */
export type HookManager = 'simple-git-hooks' | 'pre-commit' | 'lefthook' | 'husky';
/** The prepared Git directory a manager generated its hooks into, and what the generation needs. */
export type Preparation = {
    manager: HookManager;
    policy: Policy;
    root: string;
    executable: string;
    installedConfig: string;
    work: string;
    files: ConfinedRoot;
};
/** A hook a native manager generated, and the text gspot installs in its place. */
export type PreparedHook = { generated: string; installed: string };
export type Installation = {
    owner: LifecycleOwner;
    location: HookLocation;
    policy: Policy;
    manager: ReadonlyMap<string, PreparedHook> | undefined;
    recorded: Set<string>;
    nativeMarker: string | undefined;
    directory: string;
};
export type Restorations = { proposals: FileProposal[]; preserved: string[] };
