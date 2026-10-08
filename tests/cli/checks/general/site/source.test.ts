import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { svgo, webManifest } from '#cli/checks/general/site/source.ts';
import { ORIGINAL_SVG, SVG_SAVING_CASES, INVALID_WEB_MANIFESTS } from '#tests/config/cli/checks/general/site/source.ts';

test.each(INVALID_WEB_MANIFESTS)('malformed web manifest %s produces a parse finding', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': source,
    });
    const findings = webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(findings).toMatchObject([{ check: 'site/webmanifest', file: 'site.webmanifest', line: 1, rule: 'parse' }]);
});

test('a valid web manifest reports missing names and icons and accepts their correction', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': '{"icons": [{"src": "icon.png"}]}',
    });
    const rejected = webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(rejected).toMatchObject([
        { file: 'site.webmanifest', line: 1, rule: 'missing-name' },
        { file: 'site.webmanifest', line: 1, rule: 'icon' },
    ]);
    await createFileTree(sandbox.path, {
        'site.webmanifest': '{"name": "Example", "icons": [{"src": "icon.png"}]}',
        'icon.png': 'icon',
    });
    expect(webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'))).toStrictEqual([]);
});

test.each(SVG_SAVING_CASES)('SVG optimization $name', async ({ level, percent, saved, finding }) => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['site'], {
        level,
        tables:
            percent === undefined
                ? ''
                : `[tools.svgo]\nmin_saving_percent = ${String(percent)}\n[reasons]\n"tools.svgo.min_saving_percent" = "Required asset size threshold."\n`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'icon.svg': ORIGINAL_SVG });
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'svgo');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/svgo': 'fixture',
        '.gspot/node_modules/svgo/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    using _executables = mockPinnedExecutables([pin]);
    using run = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        stdout: '<svg/>'.padEnd(Buffer.byteLength(ORIGINAL_SVG) - saved),
        stderr: '',
        missing: false,
        duration: 1,
    });
    const findings = await svgo(buildCheckInput(session, 'site/svgo'));
    expect(run.mock.calls.map(([, options]) => options.stdin)).toStrictEqual([ORIGINAL_SVG]);
    if (finding) {
        expect(findings).toMatchObject([{ file: 'icon.svg', rule: 'unoptimized' }]);
    } else expect(findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'icon.svg'), 'utf8')).toBe(ORIGINAL_SVG);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});
