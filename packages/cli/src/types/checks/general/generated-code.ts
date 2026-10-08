import type { CheckDeclaration } from '#cli/types/configurations.ts';

/** Resolved native output metadata, preserving the declaration for a required-path diagnostic. */
export type GeneratedPath = NonNullable<CheckDeclaration['generated_paths']>[number] & { original: string };
