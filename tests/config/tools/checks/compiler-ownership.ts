// TypeScript suppression directives own their source line and keep their original diagnostic controls.
export const COMPILER_DIRECTIVES = ['ignore', 'expect-error', 'nocheck'] as const;

export const COMPILER_SOURCE = 'export const value = missing;\n';
export const COMPILER_CORRECTED_SOURCE = 'export const value = 1;\n';
export const COMPILER_REASON = 'The external declaration is checked by a separate contract fixture.';
