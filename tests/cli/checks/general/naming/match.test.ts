import { test, expect, describe } from 'bun:test';
import { bannedTerm } from '#cli/checks/general/naming/problems.ts';
import { compileTerms } from '#cli/checks/general/naming/policy.ts';

const TERMS = compileTerms(['common', 'edge case', 'load-bearing'], { source: 'test' });

describe('bannedTerm', () => {
    test('matches whole parts and consecutive parts only', () => {
        expect(bannedTerm(['common', 'thing'], TERMS)?.term).toBe('common');
        expect(bannedTerm(['uncommon'], TERMS)).toBeUndefined();
        expect(bannedTerm(['an', 'edge', 'case'], TERMS)?.term).toBe('edge case');
        expect(bannedTerm(['edge', 'of', 'case'], TERMS)).toBeUndefined();
        expect(bannedTerm(['load', 'bearing', 'wall'], TERMS)?.term).toBe('load-bearing');
    });
});
