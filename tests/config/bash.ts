export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;

export const BROKEN_IF_SCRIPT = 'if then\n';
