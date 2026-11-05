import {
    BASH_FORM_MESSAGES,
    type COUNT_LIMITS,
    SAFETY_RULES,
    SCRIPT_LAYOUT_RULES,
} from '#cli/config/configurations/bash.ts';
import type { BashForm } from '#cli/types/parsers.ts';
import type { RuleExplanation, RuleExplanations } from '#cli/types/tools.ts';

export const FUNCTION_SIZE_EXPLANATIONS = {
    'function-lines': {
        description: 'A function has at most `limits.bash.max_function_lines` code lines.',
        why: 'A long function does several steps that a reader must keep apart.',
        fix: 'Split the function by the steps it performs.',
        example: 'A function of 60 code lines with a limit of 50 reports `function-lines`.',
    },
    'function-branches': {
        description: 'A function has at most `limits.bash.max_function_branches` branches.',
        why: 'Each branch adds a path that a reader and a test must follow.',
        fix: 'Move the branches of one decision into a function of their own.',
        example: 'A function with 12 `if` and `case` branches with a limit of 10 reports `function-branches`.',
    },
    'block-nesting': {
        description: 'A function nests blocks at most `limits.bash.max_block_nesting` levels deep.',
        why: 'Deep nesting hides which condition a line runs under.',
        fix: 'Return early, or move the inner block into a function of its own.',
        example: 'A `for` inside an `if` inside a `while` inside a `case` with a limit of 3 reports `block-nesting`.',
    },
    'function-assignments': {
        description: 'A function assigns at most `limits.bash.max_function_assignments` variables.',
        why: 'Many assignments mean much state that a reader must track.',
        fix: 'Split the function by the steps it performs, and pass values between them.',
        example: 'A function with 20 assignments with a limit of 15 reports `function-assignments`.',
    },
} as const satisfies Readonly<Record<(typeof COUNT_LIMITS)[number]['rule'], RuleExplanation>>;

export const SAFETY_EXPLANATIONS = {
    [SAFETY_RULES.broadKill]: {
        description: 'No command stops processes by name with `pkill` or `killall`.',
        why: 'A name can match processes of other programs and other users.',
        fix: 'Keep the ID of the process that the script starts, and stop that process with `kill`.',
        example: '`pkill -f server` reports `broad-kill`; `kill "$server_pid"` does not.',
    },
    [SAFETY_RULES.recursiveRemove]: {
        description: 'No `rm -r` deletes a path other than a `mktemp` path in a trap.',
        why: 'A wrong or empty variable makes a recursive delete remove files that the script did not create.',
        fix: 'Create the folder with `mktemp -d`, and remove it in a trap. When the script must delete another path, ignore the rule.',
        example: '`rm -rf "$build_dir"` outside a trap reports `recursive-remove`.',
    },
    [SAFETY_RULES.ignoredFailure]: {
        description: 'At level `all`, no command discards its failure by falling back to `true`.',
        why: 'A hidden failure lets the script go on with a missing result.',
        fix: 'Check the status and act on it, or let `set -e` stop the script.',
        example: '`git fetch origin || true` reports `ignored-failure`.',
    },
    [SAFETY_RULES.echo]: {
        description: 'At level `all`, messages print with `printf`, not `echo`.',
        why: '`echo` treats options and backslashes in different ways on different systems.',
        fix: 'Write `printf \'%s\\n\' "<message>"`.',
        example: '`echo "$message"` reports `echo`.',
    },
    [SAFETY_RULES.loginShell]: {
        description: 'No command runs `bash -c` as a login shell.',
        why: 'A login shell loads the startup files of the user, so the command runs in a different setup on each machine.',
        fix: 'Leave out `-l` and `--login`.',
        example: '`bash -lc "make test"` reports `login-shell`.',
    },
    [SAFETY_RULES.gnuTimeout]: {
        description: 'No command calls `timeout` or `gtimeout`.',
        why: 'The command comes with GNU coreutils only, so the script fails on a stock macOS.',
        fix: 'Pass the time limit to the tool itself, such as `curl --max-time 30`.',
        example: '`timeout 30 curl https://example.com` reports `gnu-timeout`.',
    },
    [SAFETY_RULES.curlFail]: {
        description: 'Each `curl` call passes `--fail`.',
        why: 'Without it, an HTTP error page counts as a success, and the script goes on with it.',
        fix: 'Add `--fail` or `-f` to the call.',
        example: '`curl -sSL https://example.com/file.tar.gz` reports `curl-fail`.',
    },
    [SAFETY_RULES.traceMode]: {
        description: 'At level `all`, committed code does not turn on `set -x`.',
        why: 'Trace output prints every command with its values, secrets included.',
        fix: 'Remove `set -x`, and turn tracing on only when you debug.',
        example: '`set -x` at the top of a script reports `trace-mode`.',
    },
    [SAFETY_RULES.evalCommand]: {
        description: 'No command calls `eval`.',
        why: 'A value with spaces or quotes changes the command that `eval` runs.',
        fix: 'Build the command as an array of words, and expand the array in quotes to run it.',
        example: '`eval "git $arguments"` reports `eval`.',
    },
    'function-keyword': {
        description: 'At level `all`, no function definition uses the `function` keyword.',
        why: 'The keyword is a Bash extension that adds nothing to the portable form.',
        fix: BASH_FORM_MESSAGES['function-keyword'],
        example: '`function cleanup {` reports `function-keyword`; `cleanup() {` does not.',
    },
    typeset: {
        description: 'Variables use `local`, `declare`, or `readonly`, not `typeset`.',
        why: 'Bash keeps `typeset` only as an older name of `declare`.',
        fix: BASH_FORM_MESSAGES.typeset,
        example: '`typeset count=0` reports `typeset`.',
    },
    'combined-redirect': {
        description: 'At level `all`, redirects write `>file 2>&1`, not `&>`.',
        why: '`&>` is a Bash extension, and a reader can mistake it for a background job.',
        fix: BASH_FORM_MESSAGES['combined-redirect'],
        example: '`make &>build.log` reports `combined-redirect`.',
    },
    'combined-pipe': {
        description: 'Pipes that also carry standard error write `2>&1` before the pipe.',
        why: 'The short form is a Bash 4 extension, and `2>&1` states the redirect in the form that every shell reads.',
        fix: 'Redirect standard error with `2>&1` before the pipe.',
        example: '`make |& tee build.log` reports `combined-pipe`; `make 2>&1 | tee build.log` does not.',
    },
    'brace-for': {
        description: 'A `for` loop uses `do` and `done`, not a brace block.',
        why: 'Bash does not document the brace form, and the parser that gspot uses rejects it.',
        fix: BASH_FORM_MESSAGES['brace-for'],
        example: '`for arg in "$@"; { printf \'%s\\n\' "$arg"; }` reports `brace-for`.',
    },
    'seq-loop': {
        description: 'At level `all`, a counting loop uses `for (( ... ))`, not `seq`.',
        why: '`seq` starts a process, and macOS and Linux differ in its options.',
        fix: BASH_FORM_MESSAGES['seq-loop'],
        example: '`for index in $(seq 1 10); do` reports `seq-loop`.',
    },
    'script-ifs': {
        description: 'At level `all`, the script sets `IFS` only in a function or a subshell.',
        why: 'A changed `IFS` at the top of a script splits words in every later command.',
        fix: BASH_FORM_MESSAGES['script-ifs'],
        example: '`IFS=,` at the top of a script reports `script-ifs`.',
    },
    'curl-pipe-shell': {
        description: 'No download runs in a shell as it arrives.',
        why: 'Nobody can read the script before it runs, and a cut-off download runs half a script.',
        fix: 'Save the download to a file, verify its checksum, and run the file.',
        example: '`curl -fsSL https://example.com/install.sh | bash` reports `curl-pipe-shell`.',
    },
} as const satisfies Readonly<Record<(typeof SAFETY_RULES)[keyof typeof SAFETY_RULES] | BashForm, RuleExplanation>>;

export const SCRIPT_LAYOUT_EXPLANATIONS = {
    [SCRIPT_LAYOUT_RULES.shebang]: {
        description: 'A Bash script starts with the shebang `#!/usr/bin/env bash` or `#!/bin/bash`.',
        why: 'The shebang picks the shell, and the rules of BASH.md hold only for Bash.',
        fix: 'Write `#!/usr/bin/env bash` on the first line.',
        example: '`#!/bin/sh` on the first line reports `shebang`.',
    },
    [SCRIPT_LAYOUT_RULES.strictMode]: {
        description: 'An executable script runs `set -euo pipefail` before its first command.',
        why: 'Without strict mode, a failed command or an unset variable lets the script go on.',
        fix: 'Add `set -euo pipefail` as the first command after the shebang.',
        example: 'A script that runs `cd build` before `set -euo pipefail` reports `strict-mode`.',
    },
    [SCRIPT_LAYOUT_RULES.mainFunction]: {
        description: 'A script with functions has one entry point, a function named `main`.',
        why: 'One entry point lets a reader find where the script starts.',
        fix: 'Move the top-level commands into one `main` function.',
        example: 'A script with functions and no `main()` reports `main-function`.',
    },
    [SCRIPT_LAYOUT_RULES.mainCall]: {
        description: 'The last line of a script with functions calls `main "$@"`.',
        why: 'The last line then shows the reader that the script starts at `main`, with all its arguments.',
        fix: 'End the script with `main "$@"`.',
        example: 'A script that ends with `main` and no `"$@"` reports `main-call`.',
    },
    [SCRIPT_LAYOUT_RULES.executableBit]: {
        description: 'A script that ends with `main "$@"` has the executable bit.',
        why: 'Without the bit, gspot reads the script as a sourced library, and Git checks it out as not executable.',
        fix: 'Run `git update-index --chmod=+x <path>`.',
        example: 'A `scripts/deploy.sh` with mode 100644 that ends with `main "$@"` reports `executable-bit`.',
    },
    [SCRIPT_LAYOUT_RULES.libraryFlow]: {
        description: 'A sourced library only declares functions and variables at the top level.',
        why: 'A command at the top level runs in every script that sources the library.',
        fix: 'Move the command into a function, and let the script that sources the library call it.',
        example: 'A library with `cd "$root"` at the top level reports `library-flow`.',
    },
    [SCRIPT_LAYOUT_RULES.libraryOptions]: {
        description: 'Only the executable script sets shell options, never a library that it sources.',
        why: 'A changed option holds in the script that sources the library, and changes how that script runs.',
        fix: 'Remove the `set` command, and let the executable script set its options.',
        example: 'A library with `set -e` at the top level reports `library-options`.',
    },
    [SCRIPT_LAYOUT_RULES.libraryMain]: {
        description: 'Only an executable script defines and calls `main`.',
        why: 'A `main` in a library clashes with the `main` of the script that sources it.',
        fix: 'Rename the function after what it does, and remove the call.',
        example: 'A library that defines `main()` reports `library-main`.',
    },
    [SCRIPT_LAYOUT_RULES.libraryExit]: {
        description: 'No top-level `exit` runs in a sourced library.',
        why: '`exit` in a sourced file stops the script that sources it.',
        fix: 'Return a status from a function instead.',
        example: 'A library with `exit 1` at the top level reports `library-exit`.',
    },
    [SCRIPT_LAYOUT_RULES.mktempTrap]: {
        description: 'A trap removes each path that `mktemp` creates.',
        why: 'Without a trap, a failed run leaves the temporary file or folder behind.',
        fix: 'Add `trap \'rm -rf -- "$<name>"\' EXIT` after the `mktemp` line.',
        example: '`work_dir="$(mktemp -d)"` with no trap that removes `$work_dir` reports `mktemp-trap`.',
    },
} as const satisfies RuleExplanations;
