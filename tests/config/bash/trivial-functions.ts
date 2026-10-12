import { BASH_HEADER } from '#tests/config/bash/tools.ts';

export const BASH_TRIVIAL_FUNCTION_CASES = [
    {
        check: 'structure/trivial-functions',
        files: {
            'scripts/tiny.sh': `${BASH_HEADER}# _tiny: one line, one caller.
_tiny() {
    echo "$1"
}

# main: runs the script.
main() {
    _tiny "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/tiny.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'structure/trivial-functions',
        files: {
            'scripts/forward.sh': `${BASH_HEADER}# _forward: hands everything on.
_forward() {
    printf "$@"
}

# main: runs the script.
main() {
    _forward "$1"
    _forward "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/forward.sh', rule: 'trivial-function', line: 9 },
    },
] as const;
