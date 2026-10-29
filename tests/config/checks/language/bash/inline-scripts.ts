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
            'scripts/print.sh': `${BASH_HEADER}# main: runs the script.
main() {
    node -p '1 + 1'
}

main "$@"
`,
        },
        expected: { file: 'scripts/print.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        files: {
            'scripts/node-heredoc.sh': `${BASH_HEADER}# main: runs the script.
main() {
    node <<'JS'
console.log(1)
JS
}

main "$@"
`,
        },
        expected: { file: 'scripts/node-heredoc.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        files: {
            'scripts/bun.sh': `${BASH_HEADER}# main: runs the script.
main() {
    bun --eval 'console.log(1)'
}

main "$@"
`,
        },
        expected: { file: 'scripts/bun.sh', rule: 'runtime-embed', line: 10 },
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
    {
        files: {
            'scripts/perl.sh': `${BASH_HEADER}# main: runs the script.
main() {
    perl -pi -e 's/old/new/' sample.txt
}

main "$@"
`,
        },
        expected: { file: 'scripts/perl.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        files: {
            'scripts/ruby.sh': `${BASH_HEADER}# main: runs the script.
main() {
    ruby -e 'puts 1'
}

main "$@"
`,
        },
        expected: { file: 'scripts/ruby.sh', rule: 'runtime-embed', line: 10 },
    },
] as const;
