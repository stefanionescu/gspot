// Compiler suppression comments keep their source location and authored reason.
export const COMPILER_DIRECTIVES = ['ignore', 'expect-error', 'nocheck'] as const;

export const COMPILER_REASON = 'A separate sandbox checks the external declaration.';
