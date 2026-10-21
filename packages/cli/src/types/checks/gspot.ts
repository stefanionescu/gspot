import type { TrackedFile } from '#cli/types/repository/inventory.ts';

export type SuppressionSyntax = {
    covers: (file: TrackedFile) => boolean;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    /** The reason written after the marker, if the comment holds one. */
    readReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};
