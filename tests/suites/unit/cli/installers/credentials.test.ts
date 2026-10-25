import { test, expect } from 'bun:test';
import { INSTALL_OUTPUT_LIMIT } from '#cli/config/installers/credentials.ts';
import { LEAKED_LOCKFILES, REGISTRY_PASSWORDS } from '#tests/config/installers/credentials.ts';
import { extractUrlPasswords, redactInstallOutput, assertCredentialFreeLockfile } from '#cli/installers/credentials.ts';

test.each(REGISTRY_PASSWORDS)('registry passwords are read in both encodings from %s', (url, expected) => {
    expect(extractUrlPasswords(url)).toStrictEqual([...expected]);
});

test('a URL that does not parse has no password, and a bare percent stays as written', () => {
    expect(extractUrlPasswords('https://exa mple.com/simple')).toStrictEqual([]);
    expect(extractUrlPasswords('https://user:100%@example.com/simple')).toStrictEqual(['100%', '100%']);
    expect(extractUrlPasswords('https://u:pa%zz@host/')).toStrictEqual(['pa%zz', 'pa%zz']);
    expect(extractUrlPasswords('https://user:p%40ss@example.com/simple')).toStrictEqual(['p%40ss', 'p@ss']);
});

test.each([...LEAKED_LOCKFILES])(
    'a lockfile that holds a registry password in %s is refused with the message, and a clean one passes',
    (lockfile) => {
        const passwords = ['synthetic/password+with spaces'];
        const failure = 'Existing files were preserved.';
        expect(() => {
            assertCredentialFreeLockfile(lockfile, passwords, failure);
        }).toThrow(new Error(failure));
        expect(() => {
            assertCredentialFreeLockfile('url = "https://example.com/simple"', passwords, failure);
        }).not.toThrow();
    },
);

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
    for (const value of printed) expect(output).not.toContain(value);
});
