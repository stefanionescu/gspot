import { reportSchema } from '#cli/output/schema.ts';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readdirSync, symlinkSync } from 'node:fs';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Adding a configuration changes the next explicit check through its ESLint fragment.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'typescript',
    '--without',
    'naming',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PACKAGE = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n';
const LOOSE =
    "// A planted file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.object({ value: z.any() });\n";

describe('gspot add', () => {
    test(
        'adding an ESLint fragment exposes its defect on the next explicit check',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["*.ts"]\n}\n',
                'schema.ts': LOOSE,
                node_modules: {},
            });
            for (const entry of readdirSync(MODULES))
                symlinkSync(join(MODULES, entry), join(sandbox.path, 'node_modules', entry));
            symlinkSync(join(MODULES, '../packages/cli/node_modules/zod'), join(sandbox.path, 'node_modules/zod'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const before = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(before.code, before.stdout + before.stderr).toBe(0);
            const added = await run(sandbox.path, ['add', 'zod', '--json'], environment);
            expect(added.code, added.stdout + added.stderr).toBe(0);
            const after = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(after.code, after.stdout + after.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(after.stdout));
            expect(report.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
            expect(report.checks[0]?.findings).toContainEqual(
                expect.objectContaining({
                    check: 'typescript/eslint',
                    file: 'schema.ts',
                    line: 6,
                    rule: 'zod/no-any-schema',
                }),
            );
            await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE.replace('z.any()', 'z.string()'));
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'typescript/eslint', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
