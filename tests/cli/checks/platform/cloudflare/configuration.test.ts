// The built-in Cloudflare checks on a test site, run in-process: each reports its finding and passes after the fix.
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
            tables: '[scope."workers/api"]\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const input = buildCheckInput(session, 'cloudflare/headers');
    expect(headers(input).map(({ file }) => file)).toStrictEqual(['_headers']);
    expect(headers(buildCheckInput(session, 'cloudflare/headers', { scope: 'workers/api' }))).toStrictEqual([]);
});
