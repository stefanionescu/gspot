import { test, expect } from 'bun:test';
import { registryPasswords } from '#cli/parsers/credentials.ts';
import { assertCredentialFreeLock } from '#cli/tools/credentials.ts';
import { LEAKED_LOCKS, REGISTRY_PASSWORDS } from '#tests/config/cli/tools/credentials.ts';

test.each(REGISTRY_PASSWORDS)('registry password parsing preserves both representations of %s', (url, expected) => {
    expect(registryPasswords(url)).toStrictEqual([...expected]);
});

test.each([...LEAKED_LOCKS])('a generated lock containing %s fails with the installation owner error', (lock) => {
    const failure = new Error('Existing files were preserved.');
    let thrown: unknown;
    try {
        assertCredentialFreeLock(lock, ['synthetic/password+with spaces'], failure);
    } catch (error) {
        thrown = error;
    }
    expect(thrown).toBe(failure);
});

test('a credential-free lock is accepted with configured passwords or no registry authentication', () => {
    expect(() => {
        assertCredentialFreeLock(
            'url = "https://example.com/simple"',
            ['synthetic/password'],
            new Error('Credential leak'),
        );
    }).not.toThrow();
    expect(() => {
        assertCredentialFreeLock('version = 1', [], new Error('Credential leak'));
    }).not.toThrow();
});
