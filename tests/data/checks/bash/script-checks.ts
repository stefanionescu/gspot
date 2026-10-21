import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';

export const SAFETY_SOURCES = [
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n', unsafeLines: [] },
    { source: 'rm -rf /etc\n', unsafeLines: [3] },
] as const;

export const WRONG_CLEANUP_SOURCE = `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf /etc' EXIT
`;

export const RIGHT_CLEANUP_SOURCE = `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
`;

export const BASH_SAFETY_CASES = [
    {
        check: 'bash/safety',
        files: {
            'scripts/unsafe.sh': `${BASH_HEADER}# main: runs the script.
main() {
    cd "\${HOME}"
    rm -rf "\${HOME}/x" || true
}

main "$@"
`,
        },
        expected: { file: 'scripts/unsafe.sh', rule: 'ignored-failure', line: 11 },
    },
] as const;

export const INLINE_SCRIPT_CASES = [
    {
        check: 'bash/inline-scripts',
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
    {
        check: 'bash/inline-scripts',
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
        check: 'bash/inline-scripts',
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
        check: 'bash/inline-scripts',
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
        check: 'bash/inline-scripts',
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
        check: 'bash/inline-scripts',
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
        check: 'bash/inline-scripts',
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

export const SCRIPT_LAYOUT_CASES = [
    {
        check: 'bash/script-layout',
        files: {
            'scripts/headless.sh': `#!/usr/bin/env bash
main() {
    echo hi
}

main "$@"
`,
        },
        expected: { file: 'scripts/headless.sh', rule: 'strict-mode', line: 2 },
        executable: ['scripts/headless.sh'],
    },
] as const;

export const SCOPE_READER_FILES = { 'tools/env.sh': '#!/usr/bin/env bash\nload_environment\n' } as const;

export const SCOPE_READER_SETTINGS = `[[scope]]
path = "tools"
configurations = ["bash"]
[scope.structure]
environment_readers = ["tools/env.sh"]
`;

export const PASSED_BASH_RESULTS = [
    { status: 'passed' as const, findings: [] },
    { status: 'passed' as const, findings: [] },
];
