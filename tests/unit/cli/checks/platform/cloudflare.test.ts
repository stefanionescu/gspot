import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { CLOUDFLARE_HEADERS, CLOUDFLARE_REDIRECTS } from '#tests/config/cloudflare.ts';

test('Cloudflare redirects refuse Netlify-only status codes in root and child scopes', async () => {
    await using sandbox = await testdir();
    const text = CLOUDFLARE_REDIRECTS;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        _redirects: text,
        'app/_redirects': text,
    });
    const session = await openSession(sandbox.path);
    for (const scope of ['', 'app']) {
        const path = scope === '' ? '_redirects' : `${scope}/_redirects`;
        const awaitedFindings = await checkFindings(session.root, 'cloudflare/redirects', { scope });
        expect(
            awaitedFindings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
            { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
            { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
        ]);
    }
});

test('_headers syntax is checked in both scopes', async () => {
    await using sandbox = await testdir();
    const text = CLOUDFLARE_HEADERS;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: text,
        'app/_headers': text,
    });
    const session = await openSession(sandbox.path);
    for (const scope of ['', 'app']) {
        const path = scope === '' ? '_headers' : 'app/_headers';
        const nextAwaitedFindings = await checkFindings(session.root, 'cloudflare/headers', { scope });
        expect(
            nextAwaitedFindings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 1, message: 'Add a path line before this header.' },
            { file: path, line: 9, message: 'Write this header as Name: value.' },
        ]);
    }
});
