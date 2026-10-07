import { test, expect } from 'bun:test';
import { INSTALL_OUTPUT_LIMIT } from '#cli/config/tools/install.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { registryPasswords, installationDiagnostics, assertCredentialFreeLockfile } from '#cli/tools/credentials.ts';
import { LEAKED_LOCKFILES, REGISTRY_PASSWORDS, CREDENTIAL_DIAGNOSTICS } from '#tests/config/cli/tools/credentials.ts';

test.each(REGISTRY_PASSWORDS)('registry password parsing preserves both representations of %s', (url, expected) => {
    expect(registryPasswords(url)).toStrictEqual([...expected]);
});

test.each([...LEAKED_LOCKFILES])(
    'a generated lockfile containing %s fails with the installation owner error',
    (lockfile) => {
        const failure = new Error('Existing files were preserved.');
        let thrown: unknown;
        try {
            assertCredentialFreeLockfile(lockfile, ['synthetic/password+with spaces'], failure);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBe(failure);
    },
);

test('a credential-free lockfile is accepted with configured passwords or no registry authentication', () => {
    expect(() => {
        assertCredentialFreeLockfile(
            'url = "https://example.com/simple"',
            ['synthetic/password'],
            new Error('Credential leak'),
        );
    }).not.toThrow();
    expect(() => {
        assertCredentialFreeLockfile('version = 1', [], new Error('Credential leak'));
    }).not.toThrow();
});

test.each(CREDENTIAL_DIAGNOSTICS)('installation diagnostics redact $output', ({ output, expected }) => {
    expect(installationDiagnostics({ stdout: '', stderr: output }, [])).toBe(expected);
});

test('installation diagnostics redact known raw, URL-encoded, and base64 credentials before bounding output', () => {
    const credential = 'synthetic-secret/with spaces';
    const printed = [credential, encodeURIComponent(credential), Buffer.from(credential).toString('base64')];
    const output = installationDiagnostics(
        { stdout: 'Earlier output\n'.repeat(INSTALL_OUTPUT_LIMIT), stderr: `Missing tool: ${printed.join(' ')}` },
        [credential],
    );
    expect(output.startsWith('[Earlier output omitted]\n')).toBe(true);
    expect(output).toHaveLength(INSTALL_OUTPUT_LIMIT + '[Earlier output omitted]\n'.length);
    expect(output.endsWith('Missing tool: [redacted] [redacted] [redacted]')).toBe(true);
    for (const value of printed) expect(output).not.toContain(value);
});

test('installation diagnostics redact inherited authentication and distinguish absent output', () => {
    const original = environmentVariables()['GSPOT_TEST_DIAGNOSTIC_TOKEN'];
    setEnvironmentVariable('GSPOT_TEST_DIAGNOSTIC_TOKEN', 'synthetic-inherited-diagnostic-token');
    try {
        expect(installationDiagnostics({ stdout: 'synthetic-inherited-diagnostic-token', stderr: '' }, [])).toBe(
            '[redacted]',
        );
        expect(installationDiagnostics({ stdout: '  ', stderr: '\n' }, [])).toBe(
            'The package manager provided no diagnostics.',
        );
    } finally {
        setEnvironmentVariable('GSPOT_TEST_DIAGNOSTIC_TOKEN', original);
    }
});
