// The built-in Cloudflare checks on a test site, run in-process: each fires on its defect and accepts the correction.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { headers } from '#cli/checks/platform/cloudflare.ts';

test('Cloudflare header checks report only files in their owning scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['cloudflare'], {
            tables: '[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const check = session.manifests.get('cloudflare')!.checks.find((entry) => entry.name === 'cloudflare/headers')!;
    const input = buildCheckInput(session, check.name);
    expect(headers(input).map(({ file }) => file)).toStrictEqual(['_headers']);
    expect(headers({ ...input, scope: 'workers/api' })).toStrictEqual([]);
});
