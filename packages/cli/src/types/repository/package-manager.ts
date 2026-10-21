import type { PackageManagerDeclaration } from '#cli/types/parsers/dependencies.ts';

export type PackageManagerField = PackageManagerDeclaration & { declared: string; field: string };
