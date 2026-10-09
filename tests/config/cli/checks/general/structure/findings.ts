import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InProcessScenario = {
    configurations: ['bash', 'javascript'],

    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'structure/lone-files',
        files: {
            'tools/only/one.sh': CLEAN_BASH_SCRIPT,
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
            'jobs/asset-card.sh': CLEAN_BASH_SCRIPT,
            'jobs/asset-list.sh': CLEAN_BASH_SCRIPT,
            'jobs/asset-row.sh': CLEAN_BASH_SCRIPT,
        },
        expected: {
            file: 'jobs/asset-card.sh',
            rule: 'shared-prefix',
            line: 1,
        },
    },

    {
        check: 'structure/stem-collisions',
        files: {
            'jobs/turn.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
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
            'helpers/first.sh': CLEAN_BASH_SCRIPT,
            'helpers/second.sh': CLEAN_BASH_SCRIPT,
        },
        expected: {
            file: 'helpers/first.sh',
            rule: 'container-name',
            line: 1,
        },
    },
    {
        check: 'gspot/suppressions',
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
