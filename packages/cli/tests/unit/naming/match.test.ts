import { describe, expect, test } from 'bun:test';
import { bannedTerm, compileTerms, isReservedUseAllowed } from '#cli/naming/match.ts';

const TERMS = compileTerms(['common', 'edge case', 'load-bearing'], 'test');

describe('bannedTerm', () => {
    test('matches whole parts and consecutive parts only', () => {
        expect(bannedTerm(['common', 'thing'], TERMS)?.term).toBe('common');
        expect(bannedTerm(['uncommon'], TERMS)).toBeUndefined();
        expect(bannedTerm(['an', 'edge', 'case'], TERMS)?.term).toBe('edge case');
        expect(bannedTerm(['edge', 'of', 'case'], TERMS)).toBeUndefined();
        expect(bannedTerm(['load', 'bearing', 'wall'], TERMS)?.term).toBe('load-bearing');
    });

    test('a reserved use names a category class', () => {
        expect(isReservedUseAllowed(['configuration directory'], 'directories')).toBe(true);
        expect(isReservedUseAllowed(['configuration directory'], 'functions')).toBe(false);
        expect(isReservedUseAllowed(['identifier word'], 'functions')).toBe(true);
    });
});
