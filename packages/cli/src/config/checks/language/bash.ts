/** The two shebangs a Bash script may open with. */
export const BASH_SHEBANGS = ['#!/usr/bin/env bash', '#!/bin/bash'] as const;

export const EXIT_CALL = /\bexit(?:\s|$)/u;

/** The line every executable ends with. */
export const MAIN_CALL = 'main "$@"';

/** A shebang that names another shell; Bash requirements exclude these files. */
export const OTHER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;

export const READONLY_WORD = 'readonly';

/** Strict mode supported by every declared Bash version. */
export const STRICT_MODE = 'set -euo pipefail';

/** An ssh heredoc, which needs a name and a description on the line above. */
export const SSH_HEREDOC = /\bssh\b.*<</u;

/** Inline runtime embeds, and what to say about them. */
export const RUNTIME_EMBEDS = [
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+-[ep]\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bcat\s+>[^<]+<</u, 'a generated script heredoc'],
] as const;

/** Safety-rule patterns and their diagnostic text. */
export const ALL_LEVEL_SAFETY_PATTERNS = [
    [/\|\|\s*true(?:\s|$)/u, 'blanket-success', 'a command failure is discarded with || true'],
] as const;

/** Patterns requiring reasoned ignores. */
export const SAFETY_PATTERNS = [
    [/\bpkill\s+-f\b/u, 'broad-kill', 'processes are matched broadly'],
    [/\bkillall\b/u, 'broad-kill', 'processes are matched broadly'],
    [/\brm\s+-[\dA-Z_a-qs-z]*r\w*f\b/u, 'recursive-remove', 'files are removed recursively'],
    [/\brm\s+-[\dA-Z_a-eg-z]*f\w*r\b/u, 'recursive-remove', 'files are removed recursively'],
] as const;

/** A top-level assignment of an upper-case name. */
export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

/** Functions every script may leave uncalled. */
export const MAIN_FUNCTION = 'main';

/** Prose that announces a deprecated alias. */
export const DEPRECATED_ALIAS = /deprecated\s+command|deprecated\s+alias|compatibility\s+wrapper|forwarding\s+script/iu;

export const FORWARDED_SCRIPT = /\.(?:sh|js)(?:\s|$)/u;

/** A file stem that identifies a wrapper script. */
export const FORWARDER_STEM = /(?:^|[._-])(?:compat|wrapper|forward)(?:[._-]|$)/iu;

/** A line that only forwards to another script: an interpreter first, a script name after. */
export const FORWARDER_INTERPRETER = /^(?:exec )?(?:\/bin\/bash|bash|node)\s/u;

/** The most non-comment lines a script may have and still count as a forwarding wrapper. */
export const FORWARDER_MAX_LINES = 4;

/** A source statement. */
export const SOURCE_STATEMENT = /^(?:source|\.)\s+/u;

export const WORD = /[A-Za-z0-9]+/gu;

/** Words that say nothing in a function summary. */
export const VAGUE_WORDS = [
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
] as const;

/** The doc sections a function comment may carry, in the order they go. */
export const BASH_DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'] as const;

export const COUNT_LIMITS = [
    { limit: 'branches', noun: 'branches' },
    { limit: 'nesting', noun: 'levels of nesting' },
    { limit: 'assignments', noun: 'assignments' },
] as const;

/** The include guard a configuration owner opens with, and the line after it. */
export const INCLUDE_GUARD = /^\[\[ -n \$\{(?<name>[A-Z_][A-Z0-9_]*):-\} \]\] && return 0$/u;

/** A variable read with a non-empty default. */
export const DEFAULT_EXPANSION = /\$\{[A-Z_][A-Z0-9_]*:-[^}]+\}/u;

/** A comment that directs ShellCheck, which must sit on the line it covers. */
export const SHELLCHECK_TOOL_COMMENT = /^#\s*shellcheck\b/u;

export const DECLARATION_WORDS = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);

export const SET_COMMAND = 'set ';

export const LEADING_UNDERSCORES = /^_+/u;

export const NAMED_COMMENT = /^# [A-Za-z_]\w*:\s+\S/u;

export const PRIVATE_PREFIX = '_';

export const BASH_OPTION_COMMANDS = [SET_COMMAND, 'shopt '] as const;
