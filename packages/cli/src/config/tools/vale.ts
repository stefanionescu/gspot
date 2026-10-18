import { PROSE_GRAMMARS } from '#cli/config/generation/vale.ts';

/** The upstream styles shipped at level all. */
export const VALE_PACKAGES = ['Google', 'write-good', 'proselint', 'alex', 'Harper'] as const;

/** The release of each upstream style that gspot installs, so every clone checks prose with the same rules. */
export const VALE_PACKAGE_RELEASES = {
    Google: 'v0.7.1',
    'write-good': 'v0.4.1',
    proselint: 'v0.3.4',
    alex: 'v0.2.3',
    Harper: 'v0.1.0',
} as const;

/** The upstream styles: this prefix, then `<name>/releases/download/<release>/<name>.zip`. */
export const VALE_PACKAGE_REPOSITORY = 'https://github.com/vale-cli/';

/** Every folder required by the shipped upstream packages. */
export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_TOOL = 'vale';
export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

/** Comment extensions and their Vale format. */
export const PROSE_FORMATS = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
    'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
);
