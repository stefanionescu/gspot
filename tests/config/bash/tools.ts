/** Source locations for the generated Bash size samples. */
export const BASH_SIZE_LOCATIONS = [
    { file: 'scripts/long.sh', rule: 'file-lines', line: 1 },
    { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    { file: 'scripts/branchy.sh', rule: 'branches', line: 9 },
    { file: 'scripts/deep.sh', rule: 'nesting', line: 9 },
    { file: 'scripts/mutable.sh', rule: 'assignments', line: 9 },
] as const;

export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

/** Every sandbox starts from this Bash script. Its main contains several statements. */
export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="$1"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;

export const BASH_SANDBOX = {
    configurations: ['bash'],

    tools: ['shellcheck', 'shfmt'],
    files: { 'scripts/build.sh': CLEAN_BASH_SCRIPT },
} as const;

export const SHELLCHECK_CASES = [
    {
        check: 'bash/shellcheck',
        files: {
            'scripts/unquoted.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo $1
}

main "$@"
`,
        },
        expected: { file: 'scripts/unquoted.sh', rule: 'SC2086', line: 10 },
        corrected: {
            files: {
                'scripts/unquoted.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "$1"
}

main "$@"
`,
            },
        },
    },
] as const;

/** Loop headers do not count as body assignments; both loop forms count as branches and nesting. */
export const COUNTED_LOOPS = `main() {
    local declared=0
    for ((i=0; i<2; i=i+1)); do
        if [[ -n "$1" ]]; then
            for ((j=0; j<2; j=j+1)); do
                if [[ -n "$2" ]]; then
                    first=1
                    second=2
                fi
            done
        fi
    done
}
`;

export const FIXED_LOOPS = `main() {
    local declared=0
    for ((i=0; i<2; i=i+1)); do
        if [[ -n "$1" ]]; then
            first=1
        fi
    done
}
`;

export const LOOP_COUNTS = [
    { rule: 'branches', message: 'main has 4 branches, over the limit of 3.' },
    { rule: 'nesting', message: 'main has 4 levels of nesting, over the limit of 3.' },
    { rule: 'assignments', message: 'main has 2 assignments, over the limit of 1.' },
] as const;

/** Native cases include dialect findings and temporary cleanup in root and nested scopes. */
export const DIALECT_SOURCES = {
    'posix.sh': String.raw`#!/bin/sh
if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'dash.sh': String.raw`#!/bin/dash
if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'fallback.sh': String.raw`if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'unchecked.sh': `#!/bin/bash
dir="\${1:-.}"
cd "\${dir}"
printf "%s\\n" ready
`,
    'sample.bats': `@test "example" {
    true
}
`,
    'temporary.sh': `#!/bin/bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
`,
    'app/posix.sh': String.raw`#!/bin/sh
if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'app/temporary.sh': `#!/bin/bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
`,
} as const;

export const DIALECT_FIXES = {
    ...DIALECT_SOURCES,
    'posix.sh': String.raw`#!/bin/sh
if [ -n "$1" ]; then
    printf "%s\n" "$1"
fi
`,
    'dash.sh': String.raw`#!/bin/dash
if [ -n "$1" ]; then
    printf "%s\n" "$1"
fi
`,
    'unchecked.sh': `#!/bin/bash
dir="\${1:-.}"
cd "\${dir}" && printf "%s\\n" ready
`,
    'app/posix.sh': String.raw`#!/bin/sh
if [ -n "$1" ]; then
    printf "%s\n" "$1"
fi
`,
} as const;

/** Native file selection and syntax diagnostics for each interpreter. */
export const SYNTAX_CASES = [
    // Zsh reports a parse error at the end of this one-line input, on line 2.
    {
        check: 'bash/zsh-syntax',
        path: 'script.zsh',
        files: ['script.zsh', 'zlauncher'],
        broken: 'if then\n',
        line: 2,
        message: 'parse error',
    },
] as const;

export const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello $1"
}

main "$@"
`;

export const NESTED_CONDITION = 'if [[ -n "$1" ]]; then';

export const SYNTAX_FILES = {
    'script.sh': 'echo example\n',
    launcher: '#!/usr/bin/env -S bash -e\necho example\n',
    'script.zsh': 'repeat 2 do print example; done\n',
    zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
    'script.bats': `@test "example" {
    true
}
`,
} as const;

export const SHELLCHECK_RC = '.gspot/config/shellcheckrc';

/** A user command check used by repository and revision tests. */
export const BASH_SYNTAX_CHECK = String.raw`[[command_check]]
name = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
stage = "commit"
output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;
