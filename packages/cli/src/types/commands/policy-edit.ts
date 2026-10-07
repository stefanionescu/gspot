import type { CommandResult } from '#cli/types/output.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Proposal } from '#cli/types/policy/settings.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { ApplyReport } from '#cli/types/lifecycle/output.ts';

export type PreparedPolicy = Proposal & { original: FileCopy };

/** The validated authored policy a command previews without publishing. */
export type PolicyPreviewJson = { policy: string; dryRun: true };

/** A saved policy edit together with the managed apply result when apply completed. */
export type PolicyCommitResult = CommandResult & {
    json: {
        changed: boolean;
        applied?: false;
        notes?: string[];
        error?: 'preparation' | 'apply';
        message?: string;
    };
} & ({ applied: ApplyReport; session: ToolSession } | { applied?: never; session?: never });
