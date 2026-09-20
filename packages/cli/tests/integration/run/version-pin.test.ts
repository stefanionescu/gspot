import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { assertPinMatches, pinnedVersion, writePin, GSPOT_VERSION } from '#cli/run/version-pin.ts';

describe('the version pin', () => {
    test('is written, read, and refused when it differs', async () => {
        await using fixture = await createFixture({});
        expect(pinnedVersion(fixture.path)).toBeUndefined();
        writePin(fixture.path);
        expect(pinnedVersion(fixture.path)).toBe(GSPOT_VERSION);
        expect(() => {
            assertPinMatches(fixture.path);
        }).not.toThrow();
        writePin(fixture.path, '9.9.9');
        expect(() => {
            assertPinMatches(fixture.path);
        }).toThrow('gspot upgrade --to');
    });
});
