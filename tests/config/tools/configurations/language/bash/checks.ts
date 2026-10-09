import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { HEAD, CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InstalledScenario = {
    configurations: ['bash'],

    tools: ['shellcheck', 'shfmt'],
    files: { 'scripts/build.sh': CLEAN_BASH_SCRIPT },
};

export const CASES: FindingCase[] = [
    {
        check: 'bash/shellcheck',
        files: { 'scripts/unquoted.sh': `${HEAD}# main: runs the script.\nmain() {\n    echo $1\n}\n\nmain "$@"\n` },
        expected: { file: 'scripts/unquoted.sh', rule: 'SC2086', line: 10 },
    },
];
