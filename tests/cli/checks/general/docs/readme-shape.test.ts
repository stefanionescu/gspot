import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { README, LICENSE } from '#tests/config/samples/docs.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { headings, readmeShape } from '#cli/checks/general/docs.ts';

describe('readme shape', () => {
    test('a README with one H1, an opening paragraph and a setup section passes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        expect(
            readmeShape(
                buildEngineInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
            ),
        ).toStrictEqual([]);
    });

    test('a README missing the pieces names each one', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# A\n# B\n## Table of contents\n\nx\n' });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        const found = readmeShape(
            buildEngineInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
        );
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph', 'start-section']);
        const lines = headings(
            buildEngineInput(await openSession(sandbox.path), 'docs/headings', { paths: ['README.md'] }),
        ).map((finding) => finding.line);
        expect(lines).toStrictEqual([3]);
    });
    test('setext and formatted headings count, while fenced headings do not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md':
                'Thing\n=====\n\nWhat it is.\n\nSetup\n-----\n\n~~~md\n# Example\n## Project structure\n~~~~\n',
            'guide.md': '~~~md\n# Project structure\n~~~\n\n**Project structure**\n---------------------\n',
        });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        expect(
            readmeShape(
                buildEngineInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
            ),
        ).toStrictEqual([]);
        expect(
            headings(buildEngineInput(await openSession(sandbox.path), 'docs/headings', { paths: ['README.md'] })),
        ).toStrictEqual([]);
        const found = headings(
            buildEngineInput(await openSession(sandbox.path), 'docs/headings', { paths: ['guide.md'] }),
        );
        expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([[5, 'banned-heading']]);
    });

    test('a list before the setup section does not supply an opening paragraph', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' });
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
        const found = readmeShape(
            buildEngineInput(await openSession(sandbox.path), 'docs/readme-shape', { paths: ['README.md'] }),
        );
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph']);
    });
});

test('required repository documents identify a missing license and accept its restoration', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['docs'], { level: 'all' }), 'README.md': README });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'docs/readme-present', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'docs/readme-present',
            status: 'failed',
            findings: [{ file: 'LICENSE', message: 'The root has no LICENSE file.' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'LICENSE'), LICENSE);
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'docs/readme-present', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
