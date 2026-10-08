export type ParameterDiagnostic = {
    code?: string;
    rule_id?: string;
    severity?: string;
    line?: number;
    location?: { row: number };
};
