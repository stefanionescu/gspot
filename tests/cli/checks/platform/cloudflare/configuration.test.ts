// The built-in Cloudflare checks on a test site, run in-process: each reports its finding and passes after the fix.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { levelSchema } from '#cli/parsers/schema/settings.ts';
import { headers, redirects } from '#cli/checks/platform/cloudflare.ts';

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

test.each(levelSchema.options)(
    'Cloudflare redirects refuse Netlify-only status syntax at level %s in root and child scopes',
    async (level) => {
        await using sandbox = await testdir();
        const text =
            '/old /new 200\n/old /new 301\n/old /new 302\n/old /new 303\n/old /new 307\n/old /new 308\n/old /new\n/old /new 404\n/old /new 410\n/old /new 302!\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['cloudflare'], {
                level,
                tables: '[scope.app]\nconfigurations = ["cloudflare"]\n',
            }),
            _redirects: text,
            'app/_redirects': text,
        });
        const session = await openSession(sandbox.path);
        for (const scope of ['', 'app']) {
            const path = scope === '' ? '_redirects' : `${scope}/_redirects`;
            expect(
                redirects(buildCheckInput(session, 'cloudflare/redirects', { scope })).map(
                    ({ file, line, message }) => ({ file, line, message }),
                ),
            ).toStrictEqual([
                { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
                { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
                { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
            ]);
        }
    },
);
