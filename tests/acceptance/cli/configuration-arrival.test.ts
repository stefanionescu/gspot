// Adding or removing a kit changes the next explicit check through its ESLint fragment and plugin.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { existsSync, readdirSync, symlinkSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';
import { CONFIGURATION_ARRIVAL_PACKAGE } from '#tests/samples/typescript.ts';
import { INSTALL_TIMEOUT_MS, PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';

const CONFIGURATION_ARRIVAL_INIT = [
    'init',
    '--yes',
    '--kits',
    'typescript',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];

const LOOSE =
    "// A planted file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.object({ value: z.any() });\n";

const MODULES = join(import.meta.dir, '../../../node_modules');

const LINT = ['check', '--only', 'javascript/eslint', '--json'];

// Plants and commits a TypeScript project with a loose Zod schema that links the workspace modules.
async function plantProject(root: string): Promise<Record<string, string>> {
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        'package.json': CONFIGURATION_ARRIVAL_PACKAGE,
        'tsconfig.json':
            '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["*.ts"]\n}\n',
        'schema.ts': LOOSE,
        node_modules: {},
    });
    for (const entry of readdirSync(MODULES)) symlinkSync(join(MODULES, entry), join(root, 'node_modules', entry));
    symlinkSync(join(MODULES, '../packages/cli/node_modules/zod'), join(root, 'node_modules/zod'));
    commitAll(root);
    return { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
}

test(
    'adding an ESLint fragment exposes its defect on the next explicit check, and removing it drops its plugin',
    async () => {
        await using sandbox = await testdir();
        const environment = await plantProject(sandbox.path);
        await installAtLevel(sandbox.path, CONFIGURATION_ARRIVAL_INIT, environment);
        const before = await spawnGspot(sandbox.path, LINT, environment);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const added = await spawnGspot(sandbox.path, ['add', 'zod', '--json'], environment, INSTALL_TIMEOUT_MS);
        expect(added.code, added.stdout + added.stderr).toBe(0);
        const after = await spawnGspot(sandbox.path, LINT, environment);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        const report = JSON.parse(after.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
        expect(report.checks[0]?.findings).toContainEqual(
            containing({ check: 'javascript/eslint', file: 'schema.ts', line: 6, rule: 'zod/no-any-schema' }),
        );
        await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE.replace('z.any()', 'z.string()'));
        const correctedCheck = await spawnGspot(sandbox.path, LINT, environment);
        expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
        expect((JSON.parse(correctedCheck.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'passed', findings: [] },
        ]);
        await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE);
        const removed = await spawnGspot(sandbox.path, ['remove', 'zod', '--json'], environment, INSTALL_TIMEOUT_MS);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(existsSync(join(sandbox.path, '.gspot/node_modules/eslint-plugin-zod'))).toBe(false);
        const removedCheck = await spawnGspot(sandbox.path, LINT, environment);
        expect(removedCheck.code, removedCheck.stdout + removedCheck.stderr).toBe(0);
    },
    // Init, add, and remove each install the private tools.
    INSTALL_TIMEOUT_MS * 3 + PLANTED_TIMEOUT_MS,
);
