import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readdirSync, symlinkSync } from 'node:fs';
// Adding a configuration changes the next explicit check through its ESLint fragment.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { expectCorrected } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';

import {
    CONFIGURATION_ARRIVAL_INIT,
    CONFIGURATION_ARRIVAL_PACKAGE,
    LOOSE,
} from '#tests/constants/acceptance/source/cli/cli.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
describe('gspot add', () => {
    test(
        'adding an ESLint fragment exposes its defect on the next explicit check',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': CONFIGURATION_ARRIVAL_PACKAGE,
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
            await installAtLevel(sandbox.path, CONFIGURATION_ARRIVAL_INIT, environment);
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
                containing({
                    check: 'typescript/eslint',
                    file: 'schema.ts',
                    line: 6,
                    rule: 'zod/no-any-schema',
                }),
            );
            await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE.replace('z.any()', 'z.string()'));
            await expectCorrected(sandbox.path, 'typescript/eslint', environment);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
