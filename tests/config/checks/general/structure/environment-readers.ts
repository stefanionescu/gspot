import { BASH_HEADER } from '#tests/config/samples.ts';

export const BASH_ENV_READ_CASES = [
    {
        check: 'structure/environment-readers',
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
        settings: '[structure]\nenvironment_readers = ["scripts/environment.sh"]\n',
        expected: { file: 'scripts/reader.sh', rule: 'read-outside-reader', line: 10 },
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

export const PYTHON_ENVIRONMENT_SOURCE = `import os as system
from os import environ as values, getenv as read
first = system.environ["KEY"]
second = system.getenv("KEY")
third = values["KEY"]
fourth = read("KEY")
# system.environ
literal = 'system.getenv("KEY")'
def local(system):
    return system.environ
def bound():
    values = {}
    return values["KEY"]
from unrelated import getenv as other
fifth = other("KEY")
`;
