// Source CLI journey: the javascript configuration lints a repository with no TypeScript.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runPlanted } from '#tests/harness/planted/cases.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { TYPESCRIPT_PACKAGE } from '#tests/samples/typescript.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';
import { toolsPath, installPrivateTools } from '#tests/harness/tools/install.ts';

test(
    'javascript/eslint lints a project that has no TypeScript',
    async () => {
        const clean =
            '// Doubles numbers.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': TYPESCRIPT_PACKAGE,
            '.gitignore': 'node_modules/\n',
            'src/main.js': clean,
            'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
        const initialized = await spawnGspot(sandbox.path, initArgs(['javascript']), environment);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const outcome = await runPlanted(
            sandbox.path,
            {
                check: 'javascript/eslint',
                files: { 'src/paused.js': clean.replace('    return', () => '    debugger;\n    return') },
            },
            environment,
        );
        expect(outcome.code, outcome.stdout).toBe(1);
        const failed = JSON.parse(outcome.stdout) as RunReport;
        expect(failed.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            containing({ rule: 'no-debugger', file: 'src/paused.js', line: 9 }),
        );
        await Bun.write(
            join(sandbox.path, 'src/paused.js'),
            '// The number of orders.\n\n/** The number of orders. */\nexport const orderCount = 1;\n',
        );
        const corrected = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'javascript/eslint', '--json', '--', 'src/paused.js'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'passed', files: 1, findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 2,
);
