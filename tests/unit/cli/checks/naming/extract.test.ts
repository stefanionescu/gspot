import { test, expect, describe } from 'bun:test';
import { identifiersOf } from '#cli/checks/general/naming/identifiers.ts';
import { TS, SWIFT_EXTRACTOR_SOURCE, PYTHON_EXTRACTOR_SOURCE } from '#tests/inputs/unit/cli/checks/naming.ts';

describe('identifiersOf', () => {
    test('collects TypeScript declarations by category and skips object literal keys', async () => {
        const found = await identifiersOf('src/a.ts', TS, 'typescript');
        const byCategory = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(byCategory('functions')).toStrictEqual(['parseHttpUrl']);
        expect(byCategory('parameters')).toStrictEqual([
            'rawInput',
            'retries',
            'rest',
            'first',
            'second',
            'event',
            'baseUrl',
            'body',
        ]);
        expect(byCategory('variables')).toStrictEqual(['enhancedHandler', 'payload', 'table']);
        expect(byCategory('classes')).toStrictEqual(['HttpClient']);
        expect(byCategory('properties')).toStrictEqual(['secret', 'DEFAULT_PORT', 'baseUrl', 'retries']);
        expect(byCategory('methods')).toStrictEqual(['send']);
        expect(byCategory('types')).toStrictEqual(['Options', 'Verdict', 'Mode']);
        expect(byCategory('enum_cases')).toStrictEqual(['Fast', 'Slow']);
        expect(found.map((entry) => entry.name)).not.toContain('keyOne');
        expect(found.find((entry) => entry.name === 'send')?.line).toBe(9);
    });

    test('skips a name bound from another module through require or await import, and nothing else', async () => {
        const source = [
            "const { existsSync } = require('node:fs');",
            "const { default: lazyWidget } = await import('./widget.js');",
            'const loadedRecord = await loadRecord();',
            'const eagerTotal = computeTotal();',
        ].join('\n');
        const found = await identifiersOf('src/bind.ts', source, 'typescript');
        expect(found.map((entry) => entry.name)).toStrictEqual(['loadedRecord', 'eagerTotal']);
    });

    test('collects shell functions and variables', async () => {
        const found = await identifiersOf(
            'scripts/run.sh',
            'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
            'bash',
        );
        expect(found.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
            'variables:ROOT',
            'variables:count',
            'functions:build_all',
            'variables:TARGET',
        ]);
    });
});

test('collects Python declarations by category and leaves out dunder names and self', async () => {
    const found = await identifiersOf('shop/orders.py', PYTHON_EXTRACTOR_SOURCE, 'python');
    const names = (category: string): string[] =>
        found.filter((entry) => entry.category === category).map((entry) => entry.name);
    expect(names('constants')).toStrictEqual(['MAX_ITEMS']);
    expect(names('variables')).toStrictEqual(['default_name', 'local_total']);
    expect(names('type_aliases')).toStrictEqual(['OrderId']);
    expect(names('exceptions')).toStrictEqual(['OrderError']);
    expect(names('classes')).toStrictEqual(['Order_Book']);
    expect(names('attributes')).toStrictEqual(['limit']);
    expect(names('methods')).toStrictEqual(['addItem']);
    expect(names('functions')).toStrictEqual(['make_order']);
    expect(names('parameters')).toStrictEqual(['owner', 'extra', 'flags', 'item_name', 'count', 'name', 'size']);
});

test('collects Swift declarations by category', async () => {
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
