import { join } from 'node:path';
import { format } from 'prettier';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAUGHT_EXAMPLE } from '#docs/config/home.ts';
import type { GspotProject } from '#tests/types/setup.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { createGspotProject, isolatedEnvironment } from '#tests/setup/sandboxes/projects/gspot.ts';

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
            install: false,
        },
    );
    commitAll(root, 'chore: set up gspot');
    const installed = await installation.online.run(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    runGitStep(root, ['add', '--', '.gspot']);
    return root;
}

test('the home example reports its rule on both replace calls and passes after its fix', async () => {
    await using installation = await createGspotProject();
    const root = await prepareExample(installation);
    const { rule, message } = CAUGHT_EXAMPLE;
    for (const expected of [
        { calls: CAUGHT_EXAMPLE.before, code: 1, findings: CAUGHT_EXAMPLE.lines.map(() => ({ rule, message })) },
        { calls: CAUGHT_EXAMPLE.after, code: 0, findings: [] },
    ]) {
        const [install, use] = expected.calls;
        const source = `/**
Fill the install and use sections of the plugin page.

@param page the text of the plugin page
@param requirements the line that names the requirements
@param presets the list of presets
@returns the page once with each section filled
*/
export function fillPluginPage(page: string, requirements: string, presets: string): string[] {
    const installPage = ${install};
    const usePage = ${use};
    return [installPage, usePage];
}
`;
        writeFileSync(join(root, PAGE_FILE), source);
        runGitStep(root, ['add', '--', PAGE_FILE]);
        const checked = parseCheckReport(
            await installation.offline.run(root, [
                'check',
                '--staged',
                '--only',
                'javascript/eslint',
                '--json',
                PAGE_FILE,
            ]),
        );
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.code);
        const findings = checked.report.checks
            .flatMap((check) => check.findings)
            .map((finding) => ({ rule: finding.rule, message: finding.message }));
        expect(findings).toStrictEqual(expected.findings);
    }
});

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
    expect(rejected.stdout).toContain('TS2322');
    const accepted = await push(corrected);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});
