// The types of checks/language/sql in this package.
import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';

export type SqlSource = { path: string; text: string };
export type FunctionOption = {
    DefElem: { defname: string; arg: { String?: { sval: string }; List?: { items: { String: { sval: string } }[] } } };
};
export type SqlAnalysis = {
    input: EngineInput;
    source: SqlSource;
    parsed: SqlFile;
    threshold: number;
    maximum: number;
};
