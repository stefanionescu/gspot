import { describe, expect, test } from 'bun:test';
import { repeatedPart, splitParts, wordsOf } from '#cli/naming/split.ts';

describe('splitParts', () => {
    test('splits at case boundaries, separators and digit runs; an acronym is one part', () => {
        expect(splitParts('HTMLParser')).toEqual(['html', 'parser']);
        expect(splitParts('user_id')).toEqual(['user', 'id']);
        expect(splitParts('parseHttpUrl')).toEqual(['parse', 'http', 'url']);
        expect(splitParts('edge-case.test')).toEqual(['edge', 'case', 'test']);
        expect(splitParts('handlerV2')).toEqual(['handler', 'v', '2']);
        expect(wordsOf('user2')).toEqual(['user']);
    });

    test('finds the first repeated part', () => {
        expect(repeatedPart(['user', 'user', 'id'])).toBe('user');
        expect(repeatedPart(['a', 'b'])).toBeUndefined();
    });
});
