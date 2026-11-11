import { expect, test } from 'bun:test';

import { INSTALL_OUTPUT_LIMIT } from '#cli/config/tools/installers.ts';
import { extractUrlPasswords, redactInstallOutput } from '#cli/tools/installers/credentials.ts';

const REGISTRY_PASSWORDS = [
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
] as const;

test.each(REGISTRY_PASSWORDS)('registry passwords are read in both encodings from %s', (url, expected) => {
    expect(extractUrlPasswords(url)).toStrictEqual([...expected]);
});

test('a URL that does not parse has no password, and a bare percent stays as written', () => {
    expect(extractUrlPasswords('https://exa mple.com/simple')).toStrictEqual([]);
    expect(extractUrlPasswords('https://user:100%@example.com/simple')).toStrictEqual(['100%', '100%']);
});

test('installation output hides the password in a registry URL', () => {
    expect(
        redactInstallOutput(
            { stdout: '', stderr: 'GET https://alex:unknown-password@registry.example.com/private-tool: 404' },
            [],
        ),
    ).toBe('GET https://[redacted]@registry.example.com/private-tool: 404');
});

test('installation output hides known passwords in raw, URL-encoded, and base64 form before it is shortened', () => {
    const credential = 'synthetic-secret/with spaces';
    const printed = [credential, encodeURIComponent(credential), Buffer.from(credential).toString('base64')];
    const output = redactInstallOutput(
        { stdout: 'Earlier output\n'.repeat(INSTALL_OUTPUT_LIMIT), stderr: `Missing tool: ${printed.join(' ')}` },
        [credential],
    );
    expect(output).toStartWith('[Earlier output omitted]\n');
    expect(output).toHaveLength(INSTALL_OUTPUT_LIMIT + '[Earlier output omitted]\n'.length);
    expect(output).toEndWith('Missing tool: [redacted] [redacted] [redacted]');
});
