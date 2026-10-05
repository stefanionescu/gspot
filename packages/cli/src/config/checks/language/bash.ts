import type { BashCountRule } from '#cli/types/checks/language/bash.ts';
/** Features and their minimum Bash versions. */
export const BASH_FEATURES: [RegExp, string, string][] = [
    [/\b(?:mapfile|readarray)\b/u, 'mapfile and readarray need Bash 4.0', '4.0.0'],
    [/\bdeclare\s+-A\b/u, 'associative arrays need Bash 4.0', '4.0.0'],
    [/\$\{[^}\n]+(?:,,|\^\^)\}/u, 'case-conversion expansion needs Bash 4.0', '4.0.0'],
    [/\bcoproc\b/u, 'coproc needs Bash 4.0', '4.0.0'],
    [/\bwait\s+-n\b/u, 'wait -n needs Bash 4.3', '4.3.0'],
    [/\binherit_errexit\b/u, 'inherit_errexit needs Bash 4.4', '4.4.0'],
];

/** The two shebangs a Bash script may open with. */
export const BASH_SHEBANGS = ['#!/usr/bin/env bash', '#!/bin/bash'];

export const EXIT_CALL = /\bexit(?:\s|$)/u;

/** Lines 2 and 3 of the header, joined: a bare # line, then a comment that says what the script does. */
export const HEADER_COMMENT = /^#\n# .*\S/u;

/** The inherited errexit option and the Bash version that introduced it. */
export const INHERITED_ERREXIT = { statement: 'shopt -s inherit_errexit', version: '4.4.0' };

/** The line every executable ends with. */
export const MAIN_CALL = 'main "$@"';

/** A shebang that names another shell; such a file is not held to the Bash contract. */
export const OTHER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;

export const READONLY_WORD = 'readonly';

export const REMOVE_CALL = /\brm\b/u;

/** The fourth header line: the Bash version and the platforms. */
export const RUNTIME_HEADER = /^# Runtime: Bash (?<major>\d+)\.(?<minor>\d+)\+, (?<platforms>.+)\.$/u;

/** Strict mode supported by every declared Bash version. */
export const STRICT_MODE = ['set -euo pipefail'];

export const SSH_BLOCK_LINES = 3;

/** An ssh heredoc, which needs a name and a description on the line above. */
export const SSH_HEREDOC = /\bssh\b.*<</u;

/** Inline runtime embeds, and what to say about them. */
export const RUNTIME_EMBEDS: [RegExp, string][] = [
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+-[ep]\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bcat\s+>[^<]+<</u, 'a generated script heredoc'],
];

/** Safety-rule patterns and their diagnostic text. */
export const SAFETY_LINE_RULES: [RegExp, string, string][] = [
    [/\|\|\s*true(?:\s|$)/u, 'blanket-success', 'a command failure is discarded with || true'],
    [
        /\bsource\b[^\n]*(?:state|snapshot|last[_-]?config|\.env)\b/u,
        'state-source',
        'a generated state file is sourced',
    ],
];

/** Patterns only a safety owner may carry. */
export const SAFETY_OWNER_RULES: [RegExp, string, string][] = [
    [/\bpkill\s+-f\b/u, 'broad-kill', 'processes are matched broadly'],
    [/\bkillall\b/u, 'broad-kill', 'processes are matched broadly'],
    [/\brm\s+-[\dA-Z_a-qs-z]*r\w*f\b/u, 'recursive-remove', 'files are removed recursively'],
    [/\brm\s+-[\dA-Z_a-eg-z]*f\w*r\b/u, 'recursive-remove', 'files are removed recursively'],
    [/\$\{HOME\}\/\.cache["}]/u, 'unowned-cleanup', 'the home cache is swept'],
    [/\/root\/\.cache[" ]/u, 'unowned-cleanup', 'the root cache is swept'],
    [/\/tmp\/\S*\*/u, 'unowned-cleanup', 'a temporary tree is swept with a glob'],
    [/\/dev\/shm\/\S*\*/u, 'unowned-cleanup', 'shared memory is swept with a glob'],
];

/** A top-level assignment of an upper-case name. */
export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

/** Functions every script may leave uncalled; bash.entry_functions adds the ones a project names. */
export const ENTRY_FUNCTIONS = ['main'];

/** Prose that announces a deprecated alias. */
export const DEPRECATED_ALIAS = /deprecated\s+command|deprecated\s+alias|compatibility\s+wrapper|forwarding\s+script/iu;

export const FORWARDED_SCRIPT = /\.(?:sh|js)(?:\s|$)/u;

/** A file stem that says the script is a wrapper. */
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
];

/** The doc sections a function comment may carry, in the order they go. */
export const BASH_DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'];

export const COUNT_RULES: BashCountRule[] = [
    { limit: 'branches', noun: 'branches', isDepth: false },
    { limit: 'nesting', noun: 'levels of nesting', isDepth: true },
    { limit: 'assignments', noun: 'assignments', isDepth: false },
];

/** Count the matched block and the outermost block, which the nesting query cannot match. */
export const OUTER_LEVELS = 2;

/** The boundary header a script under an architecture root opens with, and how many words it needs. */
export const BOUNDARY_HEADER = /^# Boundary: (?<description>.+)$/u;

/** The first eight lines can contain the boundary declaration. */
export const BOUNDARY_HEADER_WINDOW = 8;

export const BOUNDARY_MIN_WORDS = 4;

/** The annotation a source statement carries on the line above it. */
export const SOURCE_ANNOTATION = /^# shellcheck source=(?<path>\S+)$/u;

/** The include guard a configuration owner opens with, and the line after it. */
export const CONFIG_GUARD = /^\[\[ -n \$\{(?<name>[A-Z_][A-Z0-9_]*):-\} \]\] && return 0$/u;

/** A variable read with a non-empty default. */
export const DEFAULT_EXPANSION = /\$\{[A-Z_][A-Z0-9_]*:-[^}]+\}/u;

export const SCRIPT_TAG = 'shell';

/** The bare comment marker begins the two-line script description. */
export const BARE_COMMENT_LINE = 2;

/** The fourth header line declares the Bash version and operating systems. */
export const RUNTIME_LINE = 4;

/** A comment that directs ShellCheck, which must sit on the line it covers. */
export const SHELLCHECK_DIRECTIVE = /^#\s*shellcheck\b/u;
