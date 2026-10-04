import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { webManifest } from '#cli/checks/general/site/source.ts';
import { INVALID_WEB_MANIFESTS } from '#tests/config/cli/checks/general/site/source.ts';

test.each(INVALID_WEB_MANIFESTS)('malformed web manifest %s produces a parse finding', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': source,
    });
    const findings = webManifest(buildEngineInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(findings).toMatchObject([{ check: 'site/webmanifest', file: 'site.webmanifest', line: 1, rule: 'parse' }]);
});

test('a valid web manifest reports missing names and icons and accepts their correction', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': '{"icons": [{"src": "icon.png"}]}',
    });
    const rejected = webManifest(buildEngineInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(rejected).toMatchObject([
        { file: 'site.webmanifest', line: 1, rule: 'missing-name' },
        { file: 'site.webmanifest', line: 1, rule: 'icon' },
    ]);
    await createFileTree(sandbox.path, {
        'site.webmanifest': '{"name": "Example", "icons": [{"src": "icon.png"}]}',
        'icon.png': 'icon',
    });
    expect(webManifest(buildEngineInput(await openSession(sandbox.path), 'site/webmanifest'))).toStrictEqual([]);
});
