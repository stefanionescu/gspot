import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { README, LICENSE, SETEXT_README, MISSING_SECTIONS_README } from '#tests/config/samples/docs.ts';

describe('readme shape', () => {
    test('a README with one H1, an opening paragraph and a setup section passes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        expect(
            BUILT_IN_CHECKS['docs/readme-shape'].input(
                buildCheckInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
            ),
        ).toStrictEqual([]);
    });

    test('a README missing the pieces names each one', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': MISSING_SECTIONS_README });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        const found = BUILT_IN_CHECKS['docs/readme-shape'].input(
            buildCheckInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
        );
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph', 'start-section']);
    });
    test('setext and formatted headings count, while fenced headings do not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md': SETEXT_README,
        });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        expect(
            BUILT_IN_CHECKS['docs/readme-shape'].input(
                buildCheckInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
            ),
        ).toStrictEqual([]);
    });

    test('a list before the setup section does not supply an opening paragraph', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        const found = BUILT_IN_CHECKS['docs/readme-shape'].input(
            buildCheckInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
        );
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph']);
    });
});

test('required repository documents identify a missing license and accept its restoration', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['docs'], { level: 'all' }), 'README.md': README });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'docs/required-files',
            status: 'failed',
            findings: [{ file: 'LICENSE', message: 'The root has no LICENSE file.' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'LICENSE'), LICENSE);
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each(['COPYING', 'LICENCE', 'LICENSE-MIT', 'LICENSE-APACHE', 'LICENSE.rst'])(
    'README presence accepts the repository license filename %s',
    async (name) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['docs']),
            'README.md': README,
            [name]: LICENSE,
        });
        expect(
            BUILT_IN_CHECKS['docs/required-files'].input(
                buildCheckInput(await openSession(sandbox.path), 'docs/required-files'),
            ),
        ).toStrictEqual([]);
    },
);

test('a NOTICE file does not supply the repository license', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['docs']),
        'README.md': README,
        NOTICE: 'Copyright Example',
    });
    expect(
        BUILT_IN_CHECKS['docs/required-files'].input(
            buildCheckInput(await openSession(sandbox.path), 'docs/required-files'),
        ),
    ).toMatchObject([{ file: 'LICENSE', rule: 'missing-license' }]);
});

test('README shape diagnostics give a valid reasoned exception command without changing policy on preview', async () => {
    const policy = buildPolicy([], { level: 'all' });
    await using sandbox = await testdir({ 'gspot.toml': policy, 'README.md': '# Tool\n\n## Install\n' });
    const checked = await checkReport(sandbox.path, ['check', '--only', 'docs/readme-shape', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks).toMatchObject([
        {
            check: 'docs/readme-shape',
            status: 'failed',
            findings: [
                containing({
                    file: 'README.md',
                    rule: 'opening-paragraph',
                    line: 1,
                    help: textContaining('gspot ignore docs/readme-shape --paths `<glob>` --reason "`<why>`"'),
                }),
            ],
        },
    ]);
    const preview = await runGspot(sandbox.path, [
        'ignore',
        'docs/readme-shape',
        '--paths',
        'README.md',
        '--reason',
        'The product site supplies the generated README introduction.',
        '--dry-run',
    ]);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stdout).toContain('check = "docs/readme-shape"');
    expect(preview.stdout).toMatch(/paths = \[\s*"README\.md"\s*\]/u);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});
