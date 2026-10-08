import { test, expect, describe } from 'bun:test';
import { hasCase, splitParts, repeatedPart } from '#cli/checks/general/naming/words.ts';

describe('splitParts', () => {
    test('splits at case boundaries, separators and digit runs; an acronym is one part', () => {
        expect(splitParts('HTMLParser')).toStrictEqual(['html', 'parser']);
        expect(splitParts('user_id')).toStrictEqual(['user', 'id']);
        expect(splitParts('parseHttpUrl')).toStrictEqual(['parse', 'http', 'url']);
        expect(splitParts('edge-case.test')).toStrictEqual(['edge', 'case', 'test']);
        expect(splitParts('handlerV2')).toStrictEqual(['handler', 'v', '2']);
        expect(splitParts('user2')).toStrictEqual(['user', '2']);
        expect(splitParts('decodeBase64')).toStrictEqual(['decode', 'base64']);
        expect(splitParts('s3Client')).toStrictEqual(['s3', 'client']);
        expect(splitParts('I18N')).toStrictEqual(['i18n']);
        expect(splitParts('sha256_user')).toStrictEqual(['sha256', 'user']);
    });

    test('finds the first repeated part', () => {
        expect(repeatedPart(['user', 'user', 'id'])).toBe('user');
        expect(repeatedPart(['a', 'b'])).toBeUndefined();
    });
});

test('an unknown case never matches an identifier or invokes an inherited object member', () => {
    expect(hasCase('bad_name', '__proto__')).toBe(false);
    expect(hasCase('bad_name', 'camel')).toBe(false);
    expect(hasCase('goodName', 'camel')).toBe(true);
});
