import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { format } from 'prettier';
import { createFileTree } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { pushOutputSchema } from '#tests/schemas/setup.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGspotProject, isolatedEnvironment } from '#tests/setup/sandboxes/projects/gspot.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { GspotProject } from '#tests/types/setup.ts';

const PAGE_FILE = 'src/plugin-page.ts';

async function prepareExample(installation: GspotProject): Promise<string> {
    const root = join(installation.workspace, 'example');
    mkdirSync(root);
    await createFileTree(root, {
        '.gitignore': 'node_modules/\n',
        '.prettierrc.json': '{ "tabWidth": 4, "singleQuote": true }\n',
        [PAGE_FILE]: 'export {};\n',
    });
    const devDependencies = { [cliPackage.name]: cliPackage.version };
    const projectFiles = {
        'package.json': {
            name: 'home-example',
            private: true,
            type: 'module',
            exports: `./${PAGE_FILE}`,
            devDependencies,
        },
        'package-lock.json': {
            name: 'home-example',
            lockfileVersion: 3,
            requires: true,
            packages: { '': { name: 'home-example', devDependencies } },
        },
        'tsconfig.json': { compilerOptions: { strict: true, module: 'NodeNext', target: 'ES2022' }, include: ['src'] },
    };
    for (const [path, contents] of Object.entries(projectFiles))
        writeFileSync(join(root, path), await format(JSON.stringify(contents), { filepath: path, tabWidth: 4 }));
    commitAll(root);
    await initSandbox(
        { root, run: installation.online.run },
        {
            configurations: ['typescript'],
            level: 'all',
        },
    );
    // init turns on the hooks, which start the gspot that npm installs; this test runs gspot from its installation.
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '--no-verify', '-qm', 'chore: set up gspot']);
    const installed = await installation.online.run(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    runGitStep(root, ['add', '--', '.gspot']);
    return root;
}

test('a pre-push check on Node reports a type error in a pushed commit that HEAD no longer holds', async () => {
    await using installation = await createGspotProject();
    const root = await prepareExample(installation);
    const invalid = join(root, 'src/total.ts');
    writeFileSync(invalid, "export const total: number = 'none';\n");
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '--no-verify', '-qm', 'feat: add the total']);
    const broken = runGitStep(root, ['rev-parse', 'HEAD']);
    writeFileSync(invalid, 'export const total: number = 0;\n');
    runGitStep(root, ['commit', '--no-verify', '-qam', 'fix: type the total']);
    const corrected = runGitStep(root, ['rev-parse', 'HEAD']);
    const push = async (hash: string) => {
        const cli = join(installation.root, 'node_modules', cliPackage.name, cliPackage.bin.gspot);
        const command = ['node', cli, 'check', '--hook', 'pre-push', '--only', 'typescript/tsc', '--json'];
        const stdin = `refs/heads/main ${hash} refs/heads/main ${'0'.repeat(hash.length)}\n`;
        const env = { ...isolatedEnvironment, ...installation.environment, ...OFFLINE_ENVIRONMENT };
        return await runCommand(command, { cwd: root, env, stdin });
    };
    const rejected = await push(broken);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(
        pushOutputSchema
            .parse(JSON.parse(rejected.stdout))
            .revisions[0]!.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([{ file: 'src/total.ts', rule: 'TS2322' }]);
    const accepted = await push(corrected);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});
