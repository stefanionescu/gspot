/** Built HTML rule severities generated for each selected site scope. */
export type HtmlValidationConfiguration = { rules: Record<string, unknown> };

/** A public HTML invocation and the diagnostic positions its native reader preserves. */
export type HtmlAccessibilityCheck = {
    check: string;
    scope: string;
    arguments: string[];
    source: string;
    preserved: string;
    configuration: string;
    findings: { file: string; line: number; column?: number; rule: string }[];
};
