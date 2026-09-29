import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { install } from '#tests/support/cli/tools.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { containing } from '#tests/support/expectations.ts';

const COMMAND = ['check', '--only', 'static-site/svg-optimized', '--no-cache', '--json'];

// Recommended savings thresholds and strict optimization both accept corrected bytes.
async function expectSvgThresholds(root: string, svg: string): Promise<void> {
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const small = await run(root, COMMAND);
    expect(small.code, small.stdout + small.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const large = await run(root, COMMAND);
    expect(large.code, large.stdout + large.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(large.stdout)).checks[0]!.findings).toStrictEqual([
        containing({ file: 'icon.svg', rule: 'svg' }),
    ]);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const configured = await run(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const strict = await run(root, COMMAND);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    await Bun.write(join(root, 'icon.svg'), svg);
    const corrected = await run(root, COMMAND);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
        { check: 'static-site/svg-optimized', status: 'ok', files: 1, findings: [] },
    ]);
}

// Explicit file selection excludes malformed neighbors, which fail when selected.
async function expectSvgSelection(root: string, svg: string): Promise<void> {
    const configured = await run(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg);
    await Bun.write(join(root, 'other.svg'), '<svg><broken>');
    const selected = await run(root, [...COMMAND, 'icon.svg']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const malformed = await run(root, COMMAND);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect(reportSchema.parse(JSON.parse(malformed.stdout)).checks[0]!.status).toBe('error');
    await Bun.write(join(root, 'other.svg'), svg);
    const repaired = await run(root, COMMAND);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(repaired.stdout)).checks).toMatchObject([
        { check: 'static-site/svg-optimized', status: 'ok', files: 2, findings: [] },
    ]);
}

test.each([
    { scenario: 'enforces level thresholds', verify: expectSvgThresholds },
    { scenario: 'checks exact file inputs', verify: expectSvgSelection },
])(
    'native SVG optimization $scenario',
    async ({ verify }) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n',
        });
        await install(root, initArgs(['static-site'], ['spelling', 'naming']));
        const native = await processes.run(
            [join(root, '.gspot/node_modules/.bin/svgo'), '--input', 'icon.svg', '--output', '-'],
            { cwd: root },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        await verify(root, native.stdout);
    },
    PLANTED_TIMEOUT_MS * 3,
);
