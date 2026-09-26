// Source CLI journey: the javascript configuration lints a repository with no TypeScript.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { TYPESCRIPT_PACKAGE } from '#tests/support/cli/typescript.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

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
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
        const initialized = await run(
            sandbox.path,
            [
                'init',
                '--yes',
                '--configurations',
                'javascript',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ],
            environment,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
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
        const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
        expect(failed.checks).toMatchObject([{ check: 'javascript/eslint', status: 'fail' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            containing({ rule: 'no-debugger', file: 'src/paused.js', line: 9 }),
        );
        await Bun.write(
            join(sandbox.path, 'src/paused.js'),
            '// The number of orders.\n\n/** The number of orders. */\nexport const orderCount = 1;\n',
        );
        const corrected = await run(
            sandbox.path,
            ['check', '--only', 'javascript/eslint', '--no-cache', '--json', '--', 'src/paused.js'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'ok', files: 1, findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 2,
);
