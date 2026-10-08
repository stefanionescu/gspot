import type { SourceInput } from '#cli/types/parsers/source.ts';
import type { ParsedPython } from '#cli/types/parsers/python.ts';
import type { ParsedSwift } from '#cli/types/parsers/swift/source.ts';

export type DirectiveCase = { source: string; expected: [string, ...string[]][] };

/** Native observations in the shared ownership tests. */
export type ParsedObservation = ParsedPython | ParsedSwift;

/** Reader callbacks share the source input while retaining their native result shapes. */
export type ObservationReader = (input: SourceInput) => Promise<ParsedObservation>;

/** Literal source inputs and expected observations for each native reader. */
export type ObservationCase = {
    language: 'Python' | 'Swift';
    files: Record<string, string>;
    paths: [string, string, string, string];
    functions: { path: string; name: string }[];
    names: string[];
};
