import { BASH_HEADER } from '#tests/config/bash.ts';

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
