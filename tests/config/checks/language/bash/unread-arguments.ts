import { BASH_HEADER } from '#tests/config/checks/samples.ts';

export const UNREAD_ARGUMENT_CASES = [
    {
        files: {
            'scripts/deaf.sh': `${BASH_HEADER}# _deaf: reads nothing.
_deaf() {
    echo a
    echo b
    echo c
}

# main: runs the script.
main() {
    _deaf one two
    _deaf one four
}

main "$@"
`,
        },
        expected: { file: 'scripts/deaf.sh', rule: 'unread-arguments', line: 9 },
    },
    {
        files: {
            'scripts/half.sh': `${BASH_HEADER}# _half: reads the first argument only.
_half() {
    echo a
    echo b
    echo "$1"
}

# main: runs the script.
main() {
    _half one two
    _half one four
}

main "$@"
`,
        },
        expected: { file: 'scripts/half.sh', rule: 'unread-arguments', line: 9 },
    },
] as const;
