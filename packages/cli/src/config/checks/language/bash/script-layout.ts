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

export const RULES = {
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
    ['set', { rule: RULES.libraryOptions, message: LIBRARY_OPTIONS_MESSAGE }],
    ['exit', { rule: RULES.libraryExit, message: LIBRARY_EXIT_MESSAGE }],
    ['main', { rule: RULES.libraryMain, message: LIBRARY_MAIN_CALL_MESSAGE }],
]);
