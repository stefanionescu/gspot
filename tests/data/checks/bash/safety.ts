import { BASH_HEADER } from '#tests/data/checks/bash/sandbox.ts';

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
