import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

export const CLEAN =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n';

export const REPOSITORY: InProcessScenario = {
    configurations: ['bash', 'javascript'],

    files: {
        'scripts/a.sh': CLEAN,
        'scripts/b.sh': CLEAN,
        'package.json': '{"private":true}\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'structure/lone-files',
        files: {
            'tools/only/one.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
        },
        expected: {
            file: 'tools/only/one.sh',
            rule: 'lone-file',
            line: 1,
        },
    },
    {
        check: 'structure/prefix-collisions',
        files: {
            'jobs/asset-card.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
            'jobs/asset-list.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
            'jobs/asset-row.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
        },
        expected: {
            file: 'jobs/asset-card.sh',
            rule: 'shared-prefix',
            line: 1,
        },
    },
    {
        check: 'structure/lone-files',
        files: {
            'feature/only.js': 'export const only = 1;\n',
        },
        expected: {
            file: 'feature/only.js',
            rule: 'lone-file',
            line: 1,
        },
    },
    {
        check: 'structure/prefix-collisions',
        files: {
            'cards/asset-card.js': 'export const card = 1;\n',
            'cards/asset-list.js': 'export const list = 1;\n',
            'cards/asset-row.js': 'export const row = 1;\n',
        },
        expected: {
            file: 'cards/asset-card.js',
            rule: 'shared-prefix',
            line: 1,
        },
    },
    {
        check: 'structure/stem-collisions',
        files: {
            'jobs/turn.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
            'jobs/turn/first.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
            'jobs/turn/second.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
        },
        expected: {
            file: 'jobs/turn.sh',
            rule: 'stem-collision',
            line: 1,
        },
    },
    {
        check: 'structure/folder-names',
        files: {
            'helpers/first.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
            'helpers/second.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n',
        },
        expected: {
            file: 'helpers/first.sh',
            rule: 'container-name',
            line: 1,
        },
    },
    {
        check: 'structure/suppressions',
        files: {
            'scripts/quiet.sh':
                '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    # shellcheck disable=SC2086\n    echo "${greeting}"\n}\n\nmain "$@"\n',
        },
        expected: {
            file: 'scripts/quiet.sh',
            rule: 'shellcheck-no-reason',
            line: 12,
        },
    },
    {
        check: 'gspot/unmatched-paths',
        files: {},
        policy: '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["nowhere/**"]\nreason = "A pattern that matches no file here."\n',
        expected: {
            file: 'gspot.toml',
            rule: 'unmatched-pattern',
            line: 1,
        },
        corrected: {
            files: {},
            policy: undefined,
        },
    },
];
