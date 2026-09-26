import { PROSE_GRAMMARS } from '#cli/constants/configurations.ts';
/** The [formats] lines of vale.ini: each borrowed extension, without its dot, and the format Vale reads it as. */
export const PROSE_FORMATS: [string, string][] = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
    grammar.format === undefined ? [] : [[extension.slice(1), grammar.format]],
);
