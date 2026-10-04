import { test, expect, describe } from 'bun:test';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { identifiersOf } from '#cli/checks/general/naming/identifiers.ts';

import {
    SWIFT_NAMES,
    PYTHON_NAMES,
    TYPESCRIPT_NAMES,
    SWIFT_EXTRACTOR_SOURCE,
    PYTHON_EXTRACTOR_SOURCE,
    TYPESCRIPT_EXTRACTOR_SOURCE,
} from '#tests/config/cli/checks/general/naming/extract.ts';

// Several language cases compare the same category of extracted declarations.
function namesInCategory(found: Identifier[], category: string): string[] {
    return found.filter((entry) => entry.category === category).map((entry) => entry.name);
}

describe('identifiersOf', () => {
    test('collects TypeScript declarations by category and skips object literal keys', async () => {
        const found = await identifiersOf('src/a.ts', TYPESCRIPT_EXTRACTOR_SOURCE, 'typescript');
        expect(
            Object.fromEntries(
                Object.keys(TYPESCRIPT_NAMES).map((category) => [category, namesInCategory(found, category)]),
            ),
        ).toStrictEqual(TYPESCRIPT_NAMES);
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

    test('collects Python declarations by category and leaves out dunder names and self', async () => {
        const found = await identifiersOf('shop/orders.py', PYTHON_EXTRACTOR_SOURCE, 'python');
        expect(
            Object.fromEntries(
                Object.keys(PYTHON_NAMES).map((category) => [category, namesInCategory(found, category)]),
            ),
        ).toStrictEqual(PYTHON_NAMES);
    });

    test('collects Swift declarations by category', async () => {
        const found = await identifiersOf('Sources/User.swift', SWIFT_EXTRACTOR_SOURCE, 'swift');
        expect(
            Object.fromEntries(
                Object.keys(SWIFT_NAMES).map((category) => [category, namesInCategory(found, category)]),
            ),
        ).toStrictEqual(SWIFT_NAMES);
    });
});
