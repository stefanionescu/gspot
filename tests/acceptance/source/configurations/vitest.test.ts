import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { PlantedCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the vitest configuration: a function no test calls, and a focused test.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';
import { VITEST_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';

import {
    TEST,
    UNTESTED,
    VITEST_PACKAGE,
    VITEST_SOURCE,
} from '#tests/constants/acceptance/source/configurations/configurations.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const FOCUSED = TEST.replace("test('adds", () => "test.only('adds");

const CASES: PlantedCase[] = [
    {
        check: 'vitest/coverage',
        files: { 'src/public.ts': UNTESTED },
        expected: 'Coverage for functions (50%) does not meet global threshold (80%)',
    },
    { check: 'typescript/eslint', files: { 'src/math.test.ts': FOCUSED }, expected: 'vitest/no-focused-tests' },
];

describe('the vitest configuration', () => {
    test.each(CASES)(
        '$check rejects $expected and accepts corrected tests',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': VITEST_PACKAGE,
                '.gitignore': 'node_modules\ncoverage\n',
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
                'src/public.ts': VITEST_SOURCE,
                'src/math.test.ts': TEST,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await installAtLevel(sandbox.path, VITEST_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing(
                    planted.check === 'vitest/coverage'
                        ? { message: planted.expected }
                        : { file: 'src/math.test.ts', rule: 'vitest/no-focused-tests', line: 4 },
                ),
            );
            if (planted.check === 'vitest/coverage') {
                await createFileTree(sandbox.path, {
                    'src/public.ts': UNTESTED,
                    'src/math.test.ts':
                        TEST.replace('{ positiveTotal }', '{ positiveTotal, triple }') +
                        '\ntest("triples a number", () => { expect(triple(3)).toBe(9); });\n',
                });
            }
            await expectCorrected(sandbox.path, planted.check, environment);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
