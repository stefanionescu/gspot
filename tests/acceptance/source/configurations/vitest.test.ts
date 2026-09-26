import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
// Planted repository for the vitest configuration: a function no test calls, and a focused test.
import { PLANTED_TIMEOUT_MS } from '#tests/support/cli/command.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'typescript',
    'vitest',
    '--without',
    'naming',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {\n        "vitest": "4.1.11"\n    }\n}\n';
const SOURCE =
    '// Arithmetic the planted tests call.\n\n/**\n * Adds positive values.\n * @param values the values to total\n * @returns the positive total\n */\nexport function positiveTotal(values: number[]): number {\n    let total = 0;\n    for (const value of values) {\n        if (value > 0) total += value;\n    }\n    return total;\n}\n';
const UNTESTED = `${SOURCE}\n/**\n * Triples a number.\n * @param value the number\n * @returns three times the number\n */\nexport function triple(value: number): number {\n    return value * 3;\n}\n`;
const TEST =
    "import { expect, test } from 'vitest';\nimport { positiveTotal } from './public.js';\n\ntest('adds only positive values', () => {\n    expect(positiveTotal([2, 3])).toBe(5);\n    expect(positiveTotal([-2, 3])).toBe(3);\n    expect(positiveTotal([])).toBe(0);\n});\n";
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
                'package.json': PACKAGE,
                '.gitignore': 'node_modules\ncoverage\n',
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
                'src/public.ts': SOURCE,
                'src/math.test.ts': TEST,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await installAtLevel(sandbox.path, INIT, environment);
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
