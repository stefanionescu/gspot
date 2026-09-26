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

/** The boundary header a script under an architecture root opens with, and how many words it needs. */
export const BOUNDARY_HEADER = /^# Boundary: (?<description>.+)$/u;

/** The boundary header a script under an architecture root opens with, and how many words it needs. */
export const BOUNDARY_HEADER_WINDOW = 8;

export const BOUNDARY_MIN_WORDS = 4;

export const CLOSING_QUOTE_LINE = /["']\s*$/u;

/** The include guard a configuration owner opens with, and the line after it. */
export const CONFIG_GUARD = /^\[\[ -n \$\{(?<name>_CFG_[A-Z][A-Z0-9_]*_READY):-\} \]\] && return 0$/u;

/** A variable read with a non-empty default. */
export const DEFAULT_EXPANSION = /\$\{[A-Z_][A-Z0-9_]*:-[^}]+\}/u;

/** Prose that announces a deprecated alias. */
export const DEPRECATED_ALIAS = /deprecated\s+command|deprecated\s+alias|compatibility\s+wrapper|forwarding\s+script/iu;

/** The four pieces a computed directory constant carries. */
export const DIRECTORY_CONSTANT_PIECES = ['CDPATH=', 'cd --', 'pwd -P', '||'];

export const EXIT_CALL = /\bexit(?:\s|$)/u;

export const FORWARDED_SCRIPT = /\.(?:sh|js)(?:\s|$)/u;

/** A file stem that says the script is a wrapper. */
export const FORWARDER_STEM = /(?:^|[._-])(?:compat|wrapper|forward)(?:[._-]|$)/iu;

/** A line that only forwards to another script: an interpreter first, a script name after. */
export const FORWARDING_INTERPRETER = /^(?:exec )?(?:\/bin\/bash|bash|node)\s/u;

/** The most non-comment lines a script may have and still count as a forwarding wrapper. */
export const FORWARDING_MAX_LINES = 4;

/** How many header lines the contract asks for. */
export const HEADER_LINES = 4;

/** The inherited errexit option and the Bash version that introduced it. */
export const INHERITED_ERREXIT = { statement: 'shopt -s inherit_errexit', version: '4.4.0' };

/** An inline Node snippet. */
export const INLINE_NODE = /\bnode\s+(?:-e|-p|<<)/u;

/** The line every executable ends with. */
export const MAIN_CALL = 'main "$@"';

/** A shebang that names another shell; such a file is not held to the Bash contract. */
export const OTHER_INTERPRETER_SHEBANG = /^#!.*\b(?:zsh|sh|dash|ksh)\b/u;

export const READONLY_WORD = 'readonly';

export const REMOVE_CALL = /\brm\b/u;

/** Inline runtime embeds, and what to say about them. */
export const RUNTIME_EMBEDS: [RegExp, string][] = [
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+-e\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bcat\s+>[^<]+<</u, 'a generated script heredoc'],
];

/** The fourth header line: the Bash version and the platforms. */
export const RUNTIME_HEADER = /^# Runtime: Bash (?<major>\d+)\.(?<minor>\d+)\+, (?<platforms>.+)\.$/u;

/** The start of a run_ssh block, and what closes a multi-line one. */
export const RUN_SSH_START = /run_ssh\s+(?<quote>["'])/u;

/** The safety rules, each a pattern and what to say. */
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
    [/nvidia-smi\s+--query-compute-apps=pid/u, 'gpu-sweep', 'GPU processes are swept'],
];

/** The annotation a source statement carries on the line above it. */
export const SOURCE_ANNOTATION = /^# shellcheck source=(?<path>\S+)$/u;

/** A source statement. */
export const SOURCE_STATEMENT = /^(?:source|\.)\s+/u;

export const SSH_BLOCK_MIN_LINES = 3;

/** An ssh heredoc, which needs a name and a description on the line above. */
export const SSH_HEREDOC = /\bssh\b.*<</u;

/** Strict mode supported by every declared Bash version. */
export const STRICT_MODE = ['set -euo pipefail'];

/** A top-level assignment of an upper-case name. */
export const TOP_LEVEL_ASSIGNMENT = /^(?<name>[A-Z_][A-Z0-9_]*)=/u;

/** A cd that must carry a failure path. */
export const UNCHECKED_CD = /^cd(?:\s|$)/u;
