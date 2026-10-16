import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';

export const SAFETY_SOURCES = [
    { source: 'tmp=$(mktemp)\ntrap \'tmp=/etc; rm -rf "$tmp"\' EXIT\n', unsafeLines: [4] },
    { source: 'tmp=$(mktemp)\ntrap \'rm -rf "$tmp"\' EXIT; rm -rf /etc\n', unsafeLines: [4] },
    { source: "tmp=$(mktemp)\ntrap 'rm -rf \"$tmp\"' EXIT; trap 'rm -rf /etc' HUP\n", unsafeLines: [4] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n', unsafeLines: [] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp" /etc\' EXIT\n', unsafeLines: [4] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"; rm -rf /etc\' EXIT\n', unsafeLines: [4] },
    {
        source: `tmp=$(mktemp -d)
tmp=/etc
trap 'rm -rf "$tmp"' EXIT
`,
        unsafeLines: [5],
    },
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
    cd "$1"
    rm -rf "\${HOME}/x" || true
}

main "$@"
`,
        },
        expected: { file: 'scripts/unsafe.sh', rule: 'blanket-success', line: 11 },
    },
] as const;

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
[scope.architecture.roles]
environment_readers = ["tools/env.sh"]
`;
