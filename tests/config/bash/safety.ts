import { BASH_HEADER } from '#tests/config/bash/tools.ts';

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
