export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

/** Every sandbox starts from this Bash script. Its main contains several statements. */
export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="$1"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;
export const BASH_SANDBOX = {
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;

export const SHELLCHECK_SANDBOX = {
    install: false,
    configurations: ['bash'],
    files: { 'scripts/build.sh': CLEAN_BASH_SCRIPT },
} as const;

export const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello $1"
}

main "$@"
`;
