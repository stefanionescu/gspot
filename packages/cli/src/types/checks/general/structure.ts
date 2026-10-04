export type PathPattern = { pattern: string; where: string };

export type SuppressionForm = {
    form: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};
