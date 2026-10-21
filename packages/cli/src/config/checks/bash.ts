/** The two shebangs a Bash script may open with. */
export const BASH_SHEBANGS: ReadonlySet<string> = new Set(['#!/usr/bin/env bash', '#!/bin/bash']);

export const EXIT_CALL = /\bexit(?:\s|$)/u;

/** The line every executable ends with. */
export const MAIN_CALL = 'main "$@"';

/** A shebang that names another shell; Bash requirements exclude these files. */
export const OTHER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;

export const READONLY_WORD = 'readonly';

/** Strict mode supported by every declared Bash version. */
export const STRICT_MODE = 'set -euo pipefail';

/** Inline runtime embeds, and what to say about them. */
export const RUNTIME_EMBEDS = [
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+-[ep]\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bbun\s+(?:-[ep]|--eval|--print)\b/u, 'an inline Bun command'],
    [/\bdeno\s+eval\b/u, 'an inline Deno command'],
    [/\bperl(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Perl command'],
    [/\bruby(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Ruby command'],
] as const;

/** Safety patterns and their finding text. */
export const ALL_LEVEL_SAFETY_PATTERNS = [
    [
        /\|\|\s*true(?:\s|$)/u,
        'blanket-success',
        '`|| true` hides the failure of this command. Handle the failure, or let it stop the script.',
    ],
] as const;

/** Patterns that need an ignore with a reason. */
export const SAFETY_PATTERNS = [
    [
        /\bpkill\s+-f\b/u,
        'broad-kill',
        '`pkill -f` stops every process whose command line matches. Stop the one process by its ID.',
    ],
    [/\bkillall\b/u, 'broad-kill', '`killall` stops every process with this name. Stop the one process by its ID.'],
    [
        /\brm\s+-(?:[\dA-Z_a-qs-z]*r\w*f|[\dA-Z_a-eg-z]*f\w*r)\b/u,
        'recursive-remove',
        'This line deletes files recursively. Delete only a mktemp path in a trap, or ignore this rule with a reason.',
    ],
] as const;

/** A top-level assignment of an upper-case name. */
export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

/** The function that every script may leave uncalled. */
export const MAIN_FUNCTION = 'main';

/** A source statement. */
export const SOURCE_STATEMENT = /^(?:source|\.)\s+/u;

export const WORD = /[A-Za-z0-9]+/gu;

/** Words that say nothing in a function summary. */
export const VAGUE_WORDS: ReadonlySet<string> = new Set([
    'a',
    'an',
    'and',
    'do',
    'does',
    'execute',
    'executes',
    'handle',
    'handles',
    'perform',
    'performs',
    'run',
    'runs',
    'the',
]);

/** The doc sections a function comment may carry, in the order they go. */
export const BASH_DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'] as const;

export const COUNT_LIMITS = [
    { limit: 'function_lines', rule: 'function-lines', noun: 'code lines' },
    { limit: 'function_branches', rule: 'function_branches', noun: 'branches' },
    { limit: 'block_nesting', rule: 'block_nesting', noun: 'levels of nesting' },
    { limit: 'function_assignments', rule: 'function_assignments', noun: 'assignments' },
] as const;

/** A comment that directs ShellCheck, which must sit on the line it covers. */
export const SHELLCHECK_TOOL_COMMENT = /^#\s*shellcheck\b/u;

export const DECLARATION_WORDS = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);

export const SET_COMMAND = 'set ';

export const LEADING_UNDERSCORES = /^_+/u;

export const BASH_OPTION_COMMANDS = [SET_COMMAND, 'shopt '] as const;

export const SHELLCHECK_DIALECT_FLAG = '--shell=';

export const BATS_EXTENSION = '.bats';
