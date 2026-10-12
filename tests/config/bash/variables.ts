import { BASH_HEADER } from '#tests/config/bash/tools.ts';

export const VARIABLE_DEFAULT_CASES = [
    {
        check: 'bash/variable-defaults',
        files: {
            'scripts/defaults.sh': `${BASH_HEADER}# main: runs the script.
main() {
    local port="\${PORT:-8080}"
    echo "\${port} $1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/defaults.sh', rule: 'default-outside-owner', line: 10 },
    },
] as const;

export const BASH_ENV_READ_CASES = [
    {
        check: 'structure/env-reads',
        files: {
            'scripts/environment.sh': `#!/usr/bin/env bash
#
# Owns the environment.
# Runtime: Bash 4.0+, macOS and Linux.

readonly DEPLOY_TARGET="\${1:-}"
`,
            'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "\${DEPLOY_TARGET} $1"
}

main "$@"
`,
        },
        settings: '[architecture]\nroles = { environment_readers = ["scripts/environment.sh"] }\n',
        expected: { file: 'scripts/reader.sh', rule: 'read-outside-owner', line: 10 },
        corrected: {
            files: {
                'scripts/environment.sh': '#!/usr/bin/env bash\nreadonly DEPLOY_TARGET="${1:-}"\n',
                'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "$1"
}

main "$@"
`,
            },
        },
    },
] as const;
