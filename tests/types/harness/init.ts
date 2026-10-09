import type { CiChoice } from '#cli/types/lifecycle/selection.ts';

/** Explicit integration and output choices for quiet initialization. */
export type InitArguments = {
    hooks?: boolean;
    json?: boolean;
    /** Null leaves the native CI question unanswered. */
    ci?: CiChoice | null;
};
