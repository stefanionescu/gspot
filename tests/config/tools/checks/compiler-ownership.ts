// TypeScript suppression directives own their source line and keep their original diagnostic controls.
export const COMPILER_DIRECTIVES = ['ignore', 'expect-error', 'nocheck'] as const;

export const COMPILER_SOURCE = 'export const value = missing;\n';
export const COMPILER_CORRECTED_SOURCE = 'export const value = 1;\n';
export const COMPILER_REASON = 'A separate sandbox checks the external declaration.';
