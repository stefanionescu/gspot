import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';

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

/** Scripts with dialect findings and temporary-folder cleanup in the root and a nested scope. */
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

/** File selection and syntax findings for each interpreter. */
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

export const NESTED_CONDITION = 'if [[ -n "$1" ]]; then';

/** A command check for repository and revision tests. */
export const BASH_SYNTAX_CHECK = String.raw`[[command_check]]
name = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
stage = "commit"
output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;
