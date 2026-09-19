import { describe, expect, test } from 'bun:test';
import { hasEveryPin, mergedPins } from '#cli/emit/kept-pins.ts';

describe('mergedPins', () => {
    test('a newer exact version the repository holds stays, and an older one or a range takes the pin', () => {
        const held = { placed: 'file:../plugin', newer: '1.3.24', older: '9.38.0', ranged: '^2.0.0', other: '1.0.0' };
        const pins = { placed: '0.1.0', newer: '1.3.4', older: '10.10.0', ranged: '2.1.0', added: '3.0.0' };
        expect(mergedPins(held, pins)).toEqual({
            placed: 'file:../plugin',
            newer: '1.3.24',
            older: '10.10.0',
            ranged: '2.1.0',
            other: '1.0.0',
            added: '3.0.0',
        });
        expect(hasEveryPin(mergedPins(held, pins), pins)).toBe(true);
        expect(hasEveryPin(held, pins)).toBe(false);
    });
});
