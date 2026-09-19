// Planted repository for the vitest preset: a function no test calls, and a focused test.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript,vitest',
    '--without',
    'naming,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {\n        "vitest": "4.1.11"\n    }\n}\n';
const SOURCE =
    '// Arithmetic the planted tests call.\n\n/**\n * Doubles a number.\n * @param value the number\n * @returns twice the number\n */\nexport function double(value: number): number {\n    return value * 2;\n}\n';
const UNTESTED = `${SOURCE}\n/**\n * Triples a number.\n * @param value the number\n * @returns three times the number\n */\nexport function triple(value: number): number {\n    return value * 3;\n}\n`;
const TEST =
    "import { expect, test } from 'vitest';\nimport { double } from './math.ts';\n\ntest('doubles a number', () => {\n    expect(double(2)).toBe(4);\n});\n";
const FOCUSED = TEST.replace("test('doubles", () => "test.only('doubles");

const CASES: PlantedCase[] = [
    {
        id: 'vitest/coverage',
        files: { 'src/math.ts': UNTESTED },
        expected: 'Coverage for functions (50%) does not meet global threshold (80%)',
    },
    { id: 'typescript/eslint', files: { 'src/math.test.ts': FOCUSED }, expected: 'vitest/no-focused-tests' },
];

describe('the vitest preset', () => {
    test(
        'coverage under the floor and a focused test are findings',
        async () => {
            await using fixture = await createFixture({
                'package.json': PACKAGE,
                '.gitignore': 'node_modules\ncoverage\n',
                'tsconfig.json': '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["src"]\n}\n',
                'src/math.ts': SOURCE,
                'src/math.test.ts': TEST,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = { PATH: `${MODULES}/.bin:${toolsPath(['typos', 'ec', 'ast-grep'])}` };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
