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
    'library.bash': String.raw`if [[ -n "$1" ]]; then
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

export const SHELLCHECK_DIALECT_FINDINGS = [
    { file: 'app/posix.sh', rule: 'SC3010' },
    { file: 'dash.sh', rule: 'SC3010' },
    { file: 'posix.sh', rule: 'SC3010' },
    { file: 'unchecked.sh', rule: 'SC2164' },
] as const;

export const SYNTAX_CASES = [
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
