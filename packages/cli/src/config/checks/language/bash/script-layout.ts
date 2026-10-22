export const SET_COMMAND = 'set ';

export const BASH_OPTION_COMMANDS = [SET_COMMAND, 'shopt '] as const;

/** The strict mode line, which every Bash release from 3.0 on accepts. */
export const STRICT_MODE = 'set -euo pipefail';

/** The line every executable ends with. */
export const MAIN_CALL = 'main "$@"';

export const EXIT_CALL = /\bexit(?:\s|$)/u;

export const SOURCE_STATEMENT = /^(?:source|\.)\s+/u;

export const READONLY_WORD = 'readonly';

/** A top-level assignment of an upper-case name. */
export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

/** The two shebangs a Bash script may open with. */
export const BASH_SHEBANGS: ReadonlySet<string> = new Set(['#!/usr/bin/env bash', '#!/bin/bash']);

export const DECLARATION_WORDS = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);

/** A shebang that names another shell; the Bash layout check skips these files. */
export const OTHER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;

/** The function that every script may leave uncalled. */
export const MAIN_FUNCTION = 'main';
