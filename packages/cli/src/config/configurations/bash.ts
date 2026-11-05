import type { BashCommandForm } from '#cli/types/configurations/language.ts';
import type { BashForm } from '#cli/types/parsers.ts';

export const SHELLCHECK_TOOL_COMMENT = /^#\s*shellcheck\b/u;

export const LEADING_UNDERSCORES = /^_+/u;

export const WORD = /[A-Za-z0-9]+/gu;

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

export const DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'] as const;

export const ARGUMENTS_SECTION = '# Arguments:';

export const DOC_COMMENT_RULES = {
    missingComment: 'missing-comment',
    summaryLine: 'summary-line',
    vagueSummary: 'vague-summary',
    sectionOrder: 'section-order',
    missingArguments: 'missing-arguments',
} as const;

export const COUNT_LIMITS = [
    { limit: 'max_function_lines', rule: 'function-lines', noun: 'code lines' },
    { limit: 'max_function_branches', rule: 'function-branches', noun: 'branches' },
    { limit: 'max_block_nesting', rule: 'block-nesting', noun: 'levels of nesting' },
    { limit: 'max_function_assignments', rule: 'function-assignments', noun: 'assignments' },
] as const;

export const RUNTIME_EMBEDS = [
    [/\$(?:\w+|\{\w+(?::-[^}\n]*)?\})"?\s+-[ce]\b/u, 'an inline command in an interpreter variable'],
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+(?:-[ep]|--eval|--print)\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bbun\s+(?:-[ep]|--eval|--print)\b/u, 'an inline Bun command'],
    [/\bdeno\s+eval\b/u, 'an inline Deno command'],
    [/\bperl(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Perl command'],
    [/\bruby(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Ruby command'],
] as const;

export const RUNTIME_EMBED_RULE = 'runtime-embed';

export const BROAD_KILL_COMMANDS = new Map([
    ['pkill', '`pkill -f` stops every process whose command line matches. Stop the one process by its ID.'],
    ['killall', '`killall` stops every process with this name. Stop the one process by its ID.'],
]);

export const RECURSIVE_FLAG = /^(?:--recursive|-[^-Rr]*[Rr][^-]*)$/u;

export const RECURSIVE_REMOVE_MESSAGE =
    'This line deletes files recursively. Delete only a mktemp path in a trap, or ignore this rule with a reason.';

export const IGNORED_FAILURE_MESSAGE =
    '`|| true` hides the failure of this command. Handle the failure, or let it stop the script.';

export const SAFETY_RULES = {
    broadKill: 'broad-kill',
    recursiveRemove: 'recursive-remove',
    ignoredFailure: 'ignored-failure',
    echo: 'echo',
    loginShell: 'login-shell',
    gnuTimeout: 'gnu-timeout',
    curlFail: 'curl-fail',
    traceMode: 'trace-mode',
    evalCommand: 'eval',
} as const;

export const BASH_FORM_MESSAGES: Readonly<Record<BashForm, string>> = {
    'function-keyword': 'Write `name() { ...; }`, without the `function` keyword.',
    typeset: 'Use `local`, `declare`, or `readonly` instead of `typeset`.',
    'combined-redirect': 'Write `>file 2>&1` instead of `&>`.',
    'combined-pipe': 'Write `2>&1 |` instead of `|&`.',
    'brace-for': 'Write `for arg in "$@"; do ... done`.',
    'seq-loop': 'Count with `for (( index = 0; index < count; index++ ))`, not `seq`.',
    'script-ifs': 'Set `IFS` with `local IFS` in a function or in a subshell, and do not save it to restore it.',
    'curl-pipe-shell':
        'Nobody can read a script that runs as it downloads. Download it to a file, check it, then run it.',
};

export const ALL_LEVEL_FORMS: ReadonlySet<BashForm> = new Set([
    'function-keyword',
    'combined-redirect',
    'seq-loop',
    'script-ifs',
]);

const GNU_TIMEOUT = {
    rule: SAFETY_RULES.gnuTimeout,
    message: 'macOS has no `timeout`. Use the time limit of the tool, such as `--max-time` or `ConnectTimeout`.',
};

export const COMMAND_FORMS: Readonly<Record<string, BashCommandForm | undefined>> = {
    echo: { rule: SAFETY_RULES.echo, message: 'Write messages with `printf`, not `echo`.', allLevel: true },
    eval: { rule: SAFETY_RULES.evalCommand, message: '`eval` runs a string as code. Build the command in an array.' },
    timeout: GNU_TIMEOUT,
    gtimeout: GNU_TIMEOUT,
    curl: {
        rule: SAFETY_RULES.curlFail,
        message: 'Pass `--fail`, so that an HTTP error stops the script.',
        absent: /^(?:--fail(?:-with-body)?|-[A-Za-eg-z]*f[A-Za-z]*)$/u,
    },
    bash: {
        rule: SAFETY_RULES.loginShell,
        message: 'Run the command without a login shell, which reads the profile of the host.',
        present: [/^(?:--login|-(?=[a-z]*l))/u, /^-(?=[a-z]*c)/u],
    },
    set: {
        rule: SAFETY_RULES.traceMode,
        message: 'Keep `set -x` out of committed code.',
        present: [/^(?:xtrace|-[A-Za-wyz]*x[A-Za-z]*)$/u],
        allLevel: true,
    },
};

const SET_COMMAND = 'set ';

export const OPTION_COMMANDS = [SET_COMMAND, 'shopt '] as const;

export const STRICT_MODE = 'set -euo pipefail';

export const MAIN_CALL = 'main "$@"';

export const BASH_SHEBANGS: ReadonlySet<string> = new Set(['#!/usr/bin/env bash', '#!/bin/bash']);

export const MAIN_FUNCTION_MESSAGE = 'An executable defines exactly one main function.';

const LIBRARY_OPTIONS_MESSAGE = 'A sourced library does not change shell options.';

const LIBRARY_MAIN_CALL_MESSAGE = 'A sourced library does not call main.';

const LIBRARY_EXIT_MESSAGE = 'A sourced library does not exit.';

export const LIBRARY_FLOW_MESSAGE =
    'A sourced library is declarative at the top level; this line runs when it is loaded.';

export const EXECUTABLE_BIT_MESSAGE =
    'This script ends with main "$@" but has no executable bit; run git update-index --chmod=+x on it.';

export const LIBRARY_MAIN_MESSAGE = 'A sourced library defines no main.';

export const SCRIPT_LAYOUT_RULES = {
    shebang: 'shebang',
    mktempTrap: 'mktemp-trap',
    libraryFlow: 'library-flow',
    strictMode: 'strict-mode',
    mainFunction: 'main-function',
    mainCall: 'main-call',
    libraryOptions: 'library-options',
    libraryMain: 'library-main',
    libraryExit: 'library-exit',
    executableBit: 'executable-bit',
} as const;

export const LIBRARY_DECLARATIONS = new Set(['function_definition', 'variable_assignment', 'declaration_command']);

export const LIBRARY_COMMAND_FINDINGS = new Map([
    ['set', { rule: SCRIPT_LAYOUT_RULES.libraryOptions, message: LIBRARY_OPTIONS_MESSAGE }],
    ['exit', { rule: SCRIPT_LAYOUT_RULES.libraryExit, message: LIBRARY_EXIT_MESSAGE }],
    ['main', { rule: SCRIPT_LAYOUT_RULES.libraryMain, message: LIBRARY_MAIN_CALL_MESSAGE }],
]);

export const MAIN_FUNCTION = 'main';

export const BASH_SOURCE_COMMANDS = new Set(['source', '.']);

export const READS_NO_POSITIONAL = 'reads no positional parameter';

export const UNREAD_ARGUMENTS_RULE = 'unread-arguments';

export const NEVER_CALLED_RULE = 'never-called';

export const BATS_HOOKS = new Set(['setup', 'teardown', 'setup_file', 'teardown_file']);
