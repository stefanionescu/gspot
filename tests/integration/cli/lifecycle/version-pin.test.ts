import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import packageManifest from '#cli-package' with { type: 'json' };
import { getPin, setPin, assertPinMatches } from '#cli/lifecycle/version-pin.ts';

const { version: GSPOT_VERSION } = packageManifest;

describe('the version pin', () => {
    test('is written, read, and refused when it differs', async () => {
        await using sandbox = await testdir();
        expect(getPin(sandbox.path)).toBeUndefined();
        setPin(sandbox.path);
        expect(getPin(sandbox.path)).toBe(GSPOT_VERSION);
        expect(() => {
            assertPinMatches(sandbox.path);
        }).not.toThrow();
        setPin(sandbox.path, '9.9.9');
        expect(() => {
            assertPinMatches(sandbox.path);
        }).toThrow('gspot apply');
    });
});
