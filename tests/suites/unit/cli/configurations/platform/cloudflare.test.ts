import { expect, test } from 'bun:test';

import {
    CLOUDFLARE_HEADERS,
    CLOUDFLARE_REDIRECTS,
    SECURITY_HEADER_CASES,
} from '#tests/config/configurations/platform.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('cloudflare/redirects reports each malformed redirect and each status Cloudflare does not support', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all' }),
        _redirects: CLOUDFLARE_REDIRECTS,
    });

    const path = '_redirects';
    const findings = await runSandboxCheck(sandbox.path, 'cloudflare/redirects');
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: path, line: 3, message: expect.stringContaining('404') as string },
        { file: path, line: 4, message: expect.stringContaining('302!') as string },
        { file: path, line: 5, message: expect.any(String) as string },
        { file: path, line: 6, message: expect.any(String) as string },
        { file: path, line: 8, message: expect.any(String) as string },
    ]);
});

test('cloudflare/headers reports a header before any path, a block without a leading slash, and a header without a colon', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all' }),
        _headers: CLOUDFLARE_HEADERS,
    });

    const path = '_headers';
    const headerFindings = await runSandboxCheck(sandbox.path, 'cloudflare/headers');
    expect(headerFindings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: path, line: 1, message: expect.any(String) as string },
        { file: path, line: 9, message: expect.any(String) as string },
        { file: path, line: 10, message: expect.any(String) as string },
    ]);
});

test.each(SECURITY_HEADER_CASES)(
    'cloudflare/headers checks global security headers with $name',
    async ({ text, missing }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['cloudflare']),
            _headers: text,
        });
        const findings = await runSandboxCheck(sandbox.path, 'cloudflare/headers');
        expect(findings).toStrictEqual(
            missing.map((name) =>
                matchFields({
                    file: '_headers',
                    line: 1,
                    rule: 'missing-header',
                    message: expect.stringContaining(name) as string,
                }),
            ),
        );
    },
);
