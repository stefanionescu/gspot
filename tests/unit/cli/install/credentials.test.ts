import { test, expect } from 'bun:test';
import { INSTALL_OUTPUT_LIMIT } from '#cli/config/install/credentials.ts';
import { LEAKED_LOCKFILES, REGISTRY_PASSWORDS } from '#tests/data/install/credentials.ts';
import { extractUrlPasswords, redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';

test.each(REGISTRY_PASSWORDS)('registry passwords are read in both encodings from %s', (url, expected) => {
    expect(extractUrlPasswords(url)).toStrictEqual([...expected]);
});

test.each([...LEAKED_LOCKFILES])(
    'a lockfile that holds a registry password in %s is refused with the given message, and a clean one passes',
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
    expect(output.startsWith('[Earlier output omitted]\n')).toBe(true);
    expect(output).toHaveLength(INSTALL_OUTPUT_LIMIT + '[Earlier output omitted]\n'.length);
    expect(output.endsWith('Missing tool: [redacted] [redacted] [redacted]')).toBe(true);
    for (const value of printed) expect(output).not.toContain(value);
});
