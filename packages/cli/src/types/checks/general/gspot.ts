import type { TrackedFile } from '#cli/types/repository/files.ts';

export type SuppressionSyntax = {
    covers: (file: TrackedFile) => boolean;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    readReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};
