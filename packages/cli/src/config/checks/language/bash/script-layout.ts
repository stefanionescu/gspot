export const SET_COMMAND = 'set ';

export const BASH_OPTION_COMMANDS = [SET_COMMAND, 'shopt '] as const;

export const STRICT_MODE = 'set -euo pipefail';

export const MAIN_CALL = 'main "$@"';

export const EXIT_CALL = /\bexit(?:\s|$)/u;

export const SOURCE_STATEMENT = /^(?:source|\.)\s+/u;

export const READONLY_WORD = 'readonly';

export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

export const BASH_SHEBANGS: ReadonlySet<string> = new Set(['#!/usr/bin/env bash', '#!/bin/bash']);

export const DECLARATION_WORDS = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);

export const OTHER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;
