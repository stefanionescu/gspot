export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

/** The Bash sandbox script, and the fix of each Bash sample. Its main holds several statements. */
export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;
export const BASH_SANDBOX = {
    cleanSource: CLEAN_BASH_SCRIPT,
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;
export const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello"
}

main "$@"
`;
export const PASSED_BASH_RESULTS = [
    { status: 'passed' as const, findings: [] },
    { status: 'passed' as const, findings: [] },
];
