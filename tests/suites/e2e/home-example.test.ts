import { join } from 'node:path';
import { format } from 'prettier';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GspotProject } from '#tests/types/setup.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import example from '#docs/config/example.json' with { type: 'json' };
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';

async function prepareExample(installation: GspotProject): Promise<string> {
    const root = join(installation.workspace, 'example');
    mkdirSync(root);
    await createFileTree(root, {
        '.gitignore': 'node_modules/\n',
        '.prettierrc.json': '{ "tabWidth": 4, "singleQuote": true }\n',
        'src/cart.ts': 'export type Cart = { total: number };\n',
        'src/payments.ts':
            'export async function charge(total: number): Promise<void> {\n    await Promise.resolve(total);\n}\n',
        [example.before.path]: 'export {};\n',
    });
    const devDependencies = { [cliPackage.name]: cliPackage.version };
    for (const [path, contents] of Object.entries({
        'package.json': {
            name: 'home-example',
            private: true,
            type: 'module',
            exports: './src/checkout.ts',
            devDependencies,
        },
        'package-lock.json': {
            name: 'home-example',
            lockfileVersion: 3,
            requires: true,
            packages: { '': { name: 'home-example', devDependencies } },
        },
        'tsconfig.json': { compilerOptions: { strict: true, module: 'NodeNext', target: 'ES2022' }, include: ['src'] },
    }))
        writeFileSync(join(root, path), await format(JSON.stringify(contents), { filepath: path, tabWidth: 4 }));
    commitAll(root);
    await initSandbox(
        { root, run: installation.online.run },
        {
            configurations: ['typescript'],
            level: 'basic',
            install: false,
        },
    );
    commitAll(root, 'chore: set up gspot');
    const installed = await installation.online.run(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    runGitStep(root, ['add', '--', '.gspot']);
    return root;
}

test('the home example matches staged findings and summaries and passes after its fix', async () => {
    await using installation = await createGspotProject();
    const root = await prepareExample(installation);
    for (const expected of [
        { source: example.before, code: 1, summary: example.rejectedSummary, findings: example.findings },
        { source: example.after, code: 0, summary: example.passedSummary, findings: [] },
    ]) {
        writeFileSync(join(root, expected.source.path), expected.source.content);
        runGitStep(root, ['add', '--', expected.source.path]);
        const checked = parseCheckReport(await installation.offline.run(root, ['check', '--staged', '--json']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.code);
        const findings = checked.report.checks
            .flatMap((check) => check.findings)
            .map((finding) => ({
                check: finding.check,
                file: finding.file,
                line: finding.line,
                ...(finding.column === undefined ? {} : { column: finding.column }),
                rule: finding.rule,
                message: finding.message,
            }));
        expect(findings).toStrictEqual(expected.findings);
        const text = await installation.offline.run(root, ['check', '--staged']);
        expect(text.code, text.stdout + text.stderr).toBe(expected.code);
        expect(text.stdout).toContain(example.checked);
        expect(text.stdout.split('\n').find((line) => /^(?:Failed|Passed):/u.test(line))).toBe(expected.summary);
    }
});
