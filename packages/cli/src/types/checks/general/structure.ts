export type PathPattern = { pattern: string; where: string };

export type SuppressionForm = {
    form: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};

/** The native comment marker and language-specific file ceiling. */
export type CommentStyle = readonly [language: string, marker: string];
