import { test, expect, describe } from 'bun:test';
import { bannedTerm, compileTerms, isUseAllowed } from '#cli/checks/general/naming/match.ts';

const TERMS = compileTerms(['common', 'edge case', 'load-bearing'], 'test');

describe('bannedTerm', () => {
    test('matches whole parts and consecutive parts only', () => {
        expect(bannedTerm(['common', 'thing'], TERMS)?.term).toBe('common');
        expect(bannedTerm(['uncommon'], TERMS)).toBeUndefined();
        expect(bannedTerm(['an', 'edge', 'case'], TERMS)?.term).toBe('edge case');
        expect(bannedTerm(['edge', 'of', 'case'], TERMS)).toBeUndefined();
        expect(bannedTerm(['load', 'bearing', 'wall'], TERMS)?.term).toBe('load-bearing');
    });
});

describe('isUseAllowed', () => {
    test('a reserved use names a category class', () => {
        expect(isUseAllowed(['configuration directory'], 'directories')).toBe(true);
        expect(isUseAllowed(['configuration directory'], 'functions')).toBe(false);
        expect(isUseAllowed(['identifier word'], 'functions')).toBe(true);
    });
});
