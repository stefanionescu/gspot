export type SuppressionSyntax = {
    covered: ReadonlySet<string>;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    extractReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};
