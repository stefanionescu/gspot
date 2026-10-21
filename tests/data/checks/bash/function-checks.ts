import { BASH_MAIN, BASH_HEADER } from '#tests/data/checks/bash/samples.ts';

/** Source locations for the generated Bash size samples. */
export const BASH_SIZE_LOCATIONS = [
    { file: 'scripts/long.sh', rule: 'file-lines', line: 1 },
    { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    { file: 'scripts/branchy.sh', rule: 'function_branches', line: 9 },
    { file: 'scripts/deep.sh', rule: 'block_nesting', line: 9 },
    { file: 'scripts/mutable.sh', rule: 'function_assignments', line: 9 },
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
    { rule: 'function_branches', message: 'main has 4 branches, over the limit of 3.' },
    { rule: 'block_nesting', message: 'main has 4 levels of nesting, over the limit of 3.' },
    { rule: 'function_assignments', message: 'main has 2 assignments, over the limit of 1.' },
] as const;

export const DOC_COMMENT_CASES = [
    {
        check: 'bash/doc-comments',
        files: {
            'scripts/silent.sh': `${BASH_HEADER}_quiet() {
    echo one
    echo "$1"
    echo three
}

# main: runs the script.
main() {
    _quiet "$1"
    _quiet "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/silent.sh', rule: 'missing-comment', line: 8 },
    },
] as const;

export const UNUSED_FUNCTION_CASES = [
    {
        check: 'bash/unused-functions',
        files: {
            'scripts/orphan.sh': `${BASH_HEADER}# _orphan: nobody calls this.
_orphan() {
    echo a
    echo b
    echo orphan
}

${BASH_MAIN}`,
        },
        expected: { file: 'scripts/orphan.sh', rule: 'never-called', line: 9 },
    },
] as const;

export const UNREAD_ARGUMENT_CASES = [
    {
        check: 'bash/unread-arguments',
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
        check: 'bash/unread-arguments',
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

export const TRAP_FUNCTION_SOURCE = String.raw`${BASH_HEADER}_cleanup() {
    rm -f -- "$work"
}

main() {
    work=$(mktemp)
    trap _cleanup EXIT
    printf '%s\n' "$work"
}

main "$@"
`;
