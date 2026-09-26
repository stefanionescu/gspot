import { describe, expect, test } from 'bun:test';
import { identifiersOf } from '#cli/checks/naming/extract.ts';
import { SWIFT_EXTRACTOR_SOURCE } from '#tests/constants/unit/cli/checks/naming.ts';

describe('swiftIdentifiers', () => {
    test('every declared name arrives with its category', async () => {
        const found = await identifiersOf('Sources/User.swift', SWIFT_EXTRACTOR_SOURCE, 'swift');
        const names = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(names('types')).toStrictEqual(['Greeter', 'Mood', 'UserProfile', 'Handler']);
        expect(names('methods')).toStrictEqual(['greet', 'greet']);
        expect(names('functions')).toStrictEqual(['top_level']);
        expect(names('parameters')).toStrictEqual(['name', 'userName', 'id', 'value', 'label']);
        expect(names('properties')).toStrictEqual(['maxCount', 'display_name', 'short']);
        expect(names('variables')).toStrictEqual(['local_value']);
        expect(names('constants')).toStrictEqual(['globalConstant']);
        expect(names('enum_cases')).toStrictEqual(['happy', 'sad', 'veryAngry']);
    });
});
