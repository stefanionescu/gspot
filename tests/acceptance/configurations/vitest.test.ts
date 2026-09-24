import { symlinkSync } from 'node:fs';
// Planted repository for the vitest configuration: a function no test calls, and a focused test.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const MODULES = join(import.meta.dir, '../../../node_modules');
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
    test(
        'coverage under the floor and a focused test are findings',
        async () => {
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
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
