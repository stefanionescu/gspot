import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    CLOUDFLARE_HEADERS,
    CLOUDFLARE_REDIRECTS,
    CLOUDFLARE_SCOPE_SETTINGS,
} from '#tests/config/checks/platform/cloudflare.ts';

test.each(['', 'app'])(
    'cloudflare/redirects reports each malformed redirect and each status Cloudflare does not support, in scope %j',
    async (scope) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all', scopes: CLOUDFLARE_SCOPE_SETTINGS }),
            _redirects: CLOUDFLARE_REDIRECTS,
            'app/_redirects': CLOUDFLARE_REDIRECTS,
        });

        const path = scope === '' ? '_redirects' : `${scope}/_redirects`;
        const findings = await runSandboxCheck(sandbox.path, 'cloudflare/redirects', { scope });
        expect(
            findings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
            { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
            { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
            { file: path, line: 11, message: 'Write a redirect as a source, a destination, and an optional status.' },
            { file: path, line: 12, message: 'Start the redirect source with / or https://.' },
        ]);
    },
);

test.each(['', 'app'])(
    'cloudflare/headers reports a header before any path, a block without a leading slash, and a header without a colon, in scope %j',
    async (scope) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['cloudflare'], { level: 'all', scopes: CLOUDFLARE_SCOPE_SETTINGS }),
            _headers: CLOUDFLARE_HEADERS,
            'app/_headers': CLOUDFLARE_HEADERS,
        });

        const path = scope === '' ? '_headers' : 'app/_headers';
        const headerFindings = await runSandboxCheck(sandbox.path, 'cloudflare/headers', { scope });
        expect(
            headerFindings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 1, message: 'Add a path line before this header.' },
            { file: path, line: 9, message: 'Write this header as Name: value.' },
            { file: path, line: 10, message: 'Start this block with a path beginning with / or an https:// address.' },
        ]);
    },
);
