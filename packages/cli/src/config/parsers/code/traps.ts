import { EXPANSION_NODES } from '#cli/config/parsers/code/bash.ts';

export const FORWARDED_ARGUMENTS: ReadonlySet<string> = new Set(['"$@"', '"$*"']);

export const TRAP_COMMAND = 'trap';

export const TRAP_EXPANSION_NODES = [...EXPANSION_NODES, 'command_substitution', 'arithmetic_expansion'];

export const TRAP_STRING_ESCAPES = /\\(["\\$\u{60}\n])|\n/gu;

export const TRAP_SOURCE_ROWS = /\n/gu;
