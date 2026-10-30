import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    CLOUDFLARE_HEADERS,
    CLOUDFLARE_REDIRECTS,
    SECURITY_HEADER_CASES,
} from '#tests/config/checks/platform/cloudflare.ts';

test('cloudflare/redirects reports each malformed redirect and each status Cloudflare does not support', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all' }),
        _redirects: CLOUDFLARE_REDIRECTS,
    });

    const path = '_redirects';
    const findings = await runSandboxCheck(sandbox.path, 'cloudflare/redirects');
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
        { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
        { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
        { file: path, line: 11, message: 'Write a redirect as a source, a destination, and an optional status.' },
        { file: path, line: 12, message: 'Start the source with /.' },
    ]);
});

test('cloudflare/headers reports a header before any path, a block without a leading slash, and a header without a colon', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all' }),
        _headers: CLOUDFLARE_HEADERS,
    });

    const path = '_headers';
    const headerFindings = await runSandboxCheck(sandbox.path, 'cloudflare/headers');
    expect(headerFindings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: path, line: 1, message: 'Add a path line before this header.' },
        { file: path, line: 9, message: 'Write this header as Name: value.' },
        { file: path, line: 10, message: 'Start this block with a path beginning with / or an https:// address.' },
    ]);
});

test.each(SECURITY_HEADER_CASES)(
    'cloudflare/headers checks global security headers with $name',
    async ({ text, missing }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['cloudflare']),
            _headers: text,
        });
        const findings = await runSandboxCheck(sandbox.path, 'cloudflare/headers');
        expect(findings).toStrictEqual(
            missing.map((name) => ({
                check: 'cloudflare/headers',
                file: '_headers',
                line: 1,
                rule: 'missing-header',
                fixable: false,
                message: `The block for /* sets no valid ${name} header.`,
                help: 'Write each block as a path, then indented lines of a name, a colon, and a value. Add each missing security header to the block for `/*`.',
            })),
        );
    },
);
