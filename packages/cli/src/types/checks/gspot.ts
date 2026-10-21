import type { TrackedFile } from '#cli/types/repository/inventory.ts';

export type SuppressionSyntax = {
    covers: (file: TrackedFile) => boolean;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};
