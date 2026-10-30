import { BASH_HEADER } from '#tests/config/bash.ts';

export const SHEBANG_DOC_SCRIPT = String.raw`#!/usr/bin/env bash
# log_line: print a timestamped message to standard error.
# Arguments:
#   Message text.
log_line() {
    printf '%s\n' "$1" >&2
}
`;

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

export const BASH_SIZE_CASES = [
    {
        file: 'scripts/tall.sh',
        rule: 'function-lines',
        line: 9,
        limit: 12,
        message: 'main has 13 code lines, over the limit of 12.',
    },
    {
        file: 'scripts/branchy.sh',
        rule: 'function-branches',
        line: 9,
        limit: 4,
        message: 'main has 5 branches, over the limit of 4.',
    },
    {
        file: 'scripts/deep.sh',
        rule: 'block-nesting',
        line: 9,
        limit: 2,
        message: 'main has 3 levels of nesting, over the limit of 2.',
    },
    {
        file: 'scripts/mutable.sh',
        rule: 'function-assignments',
        line: 9,
        limit: 3,
        message: 'main has 4 assignments, over the limit of 3.',
    },
] as const;

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

export const CORRECTED_LOOPS = `main() {
    local declared=0
    for ((i=0; i<2; i=i+1)); do
        if [[ -n "$1" ]]; then
            first=1
        fi
    done
}
`;

export const INLINE_SCRIPT_CASES = [
    {
        files: {
            'scripts/node.sh': `${BASH_HEADER}# main: runs the script.
main() {
    node -e 'console.log(1)'
}

main "$@"
`,
        },
        expected: { file: 'scripts/node.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        files: {
            'scripts/python.sh': `${BASH_HEADER}# main: runs the script.
main() {
    python3 - <<'PY'
print(1)
PY
}

main "$@"
`,
        },
        expected: { file: 'scripts/python.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        files: {
            'scripts/deno.sh': `${BASH_HEADER}# main: runs the script.
main() {
    deno eval 'console.log(1)'
}

main "$@"
`,
        },
        expected: { file: 'scripts/deno.sh', rule: 'runtime-embed', line: 10 },
    },
] as const;

export const BASH_SAFETY_CASES = [
    {
        check: 'bash/safety',
        files: {
            'scripts/unsafe.sh': `${BASH_HEADER}# main: runs the script.
main() {
    cd "\${HOME}"
    touch "\${HOME}/x" || true
}

main "$@"
`,
        },
        expected: { file: 'scripts/unsafe.sh', rule: 'ignored-failure', line: 11 },
    },
] as const;

export const COMMAND_SAFETY_CASES = [
    { source: 'rm -rf /etc', rule: 'recursive-remove' },
    { source: 'rm -r -f /etc', rule: 'recursive-remove' },
    { source: 'rm -r /etc', rule: 'recursive-remove' },
    { source: 'rm --recursive --force /etc', rule: 'recursive-remove' },
    { source: 'pkill -f node', rule: 'broad-kill' },
    { source: 'killall node', rule: 'broad-kill' },
    { source: 'false || :', rule: 'ignored-failure' },
    { source: "echo 'rm -rf /etc'", rule: undefined },
] as const;

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

export const TRAP_SCRIPT_FORMS = ['_cleanup', "'_cleanup'", "'_cleanup; exit 1'"];

const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello"
}

main "$@"
`;

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

export const LITERAL_FUNCTION_REFERENCES = ['_retry _download', 'xargs -n1 _each', 'export -f _each'] as const;
