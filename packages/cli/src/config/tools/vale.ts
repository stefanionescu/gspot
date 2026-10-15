import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';

/** The upstream styles shipped at level all. */
export const VALE_PACKAGES = ['Google', 'write-good', 'proselint', 'alex', 'Harper'] as const;

/** Every folder required by the shipped upstream packages. */
export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_TOOL = 'vale';
export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

export const VALE_RULE_EXTENSION = '.yml';

/** Comment extensions and their native Vale format. */
export const PROSE_FORMATS = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
    'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
);
