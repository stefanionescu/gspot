import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const ENV_SOURCE = 'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['secrets'],
    modules: false,
    init: [...QUIET_INIT],
    tools: ['dotenv-linter'],
    files: { '.env.example': 'PORT=3000\n' },
};

export const CASES: FindingCase[] = [
    {
        check: 'secrets/dotenv-linter',
        files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
    {
        check: 'secrets/env-example',
        files: { '.env.example': 'PORT=3000\n', 'src/server.js': ENV_SOURCE },
        expected: { file: 'src/server.js', line: 1, rule: 'missing-key' },
        corrected: { files: { '.env.example': 'PORT=3000\nHOST=localhost\n', 'src/server.js': ENV_SOURCE } },
    },
];
