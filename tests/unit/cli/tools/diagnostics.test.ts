import { test, expect } from 'bun:test';
import { INSTALL_OUTPUT_LIMIT } from '#cli/config/tools/diagnostics.ts';
import { LEAKED_LOCKFILES, REGISTRY_PASSWORDS } from '#tests/config/tools.ts';
import { extractUrlPasswords, redactInstallOutput, assertCredentialFreeLockfile } from '#cli/tools/credentials.ts';

test.each(REGISTRY_PASSWORDS)('registry passwords are read in both encodings from %s', (url, expected) => {
    expect(extractUrlPasswords(url)).toStrictEqual([...expected]);
});

test.each(LEAKED_LOCKFILES)('a lockfile that holds %s is refused', (lockfile) => {
    const failure = new Error('Existing files were preserved.');
    expect(() => {
        assertCredentialFreeLockfile(lockfile, ['synthetic/password+with spaces'], failure);
    }).toThrow(failure);
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
    expect(output.startsWith('[Earlier output omitted]\n')).toBe(true);
    expect(output).toHaveLength(INSTALL_OUTPUT_LIMIT + '[Earlier output omitted]\n'.length);
    expect(output.endsWith('Missing tool: [redacted] [redacted] [redacted]')).toBe(true);
    for (const value of printed) expect(output).not.toContain(value);
});
