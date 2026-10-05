import type { CommandResult } from '#cli/types/output.ts';
import type { Snapshot } from '#cli/types/platform/root.ts';
import type { Proposal } from '#cli/types/policy/settings.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { ApplyReport } from '#cli/types/lifecycle/output.ts';

export type PreparedPolicy = Proposal & { original: Snapshot };

/** A saved policy edit together with the managed apply result when apply completed. */
export type PolicyCommitResult = CommandResult & {
    json: {
        changed: boolean;
        applied?: false;
        notes?: string[];
        error?: 'preparation' | 'apply';
        message?: string;
    };
} & ({ applied: ApplyReport; session: Session } | { applied?: never; session?: never });
