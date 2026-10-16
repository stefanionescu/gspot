import { BASH_HEADER } from '#tests/config/bash/tools.ts';

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
