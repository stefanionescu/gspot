import { BASH_HEADER } from '#tests/config/bash/tools.ts';

export const NODE_EMBEDS = [
    'node -e "console.log(1)"\n',
    'node -p "1 + 1"\n',
    `node <<'JS'
console.log(1)
JS
`,
] as const;

export const INLINE_SCRIPT_CASES = [
    {
        check: 'bash/inline-scripts',
        files: {
            'scripts/node.sh': `${BASH_HEADER}# main: runs the script.
main() {
    node -e 'console.log(1)' "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/node.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        check: 'bash/inline-scripts',
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
] as const;
