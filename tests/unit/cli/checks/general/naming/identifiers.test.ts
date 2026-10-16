import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Identifier } from '#cli/types/checks/general.ts';
import { readNamingDefaults } from '#cli/configurations/manifests.ts';
import { identifiersOf, fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/identifiers.ts';

import {
    SOURCE_ORDER_CASES,
    NAME_POSITION_CASES,
    EXPECTED_SWIFT_NAMES,
    EXPECTED_PYTHON_NAMES,
    SWIFT_EXTRACTOR_SOURCE,
    PYTHON_EXTRACTOR_SOURCE,
    EXPECTED_TYPESCRIPT_NAMES,
    TYPESCRIPT_EXTRACTOR_SOURCE,
} from '#tests/config/naming/sources.ts';

// Several language cases compare the same category of extracted declarations.
function namesInCategory(found: Identifier[], category: string): string[] {
    return found.filter((entry) => entry.category === category).map((entry) => entry.name);
}

test('TypeScript declarations are collected by category; object literal keys are not', async () => {
    const found = await identifiersOf('src/a.ts', TYPESCRIPT_EXTRACTOR_SOURCE, 'typescript');
    expect(
        Object.fromEntries(
            Object.keys(EXPECTED_TYPESCRIPT_NAMES).map((category) => [category, namesInCategory(found, category)]),
        ),
    ).toStrictEqual(
        Object.fromEntries(
            Object.entries(EXPECTED_TYPESCRIPT_NAMES).map(([category, names]) => [category, [...names]]),
        ),
    );
    expect(found.map((entry) => entry.name)).not.toContain('keyOne');
    expect(found.find((entry) => entry.name === 'send')?.line).toBe(9);
});

test('a name bound from another module through require or await import is skipped, and nothing else', async () => {
    const source = [
        "const { existsSync } = require('node:fs');",
        "const { default: lazyWidget } = await import('./widget.js');",
        'const loadedRecord = await loadRecord();',
        'const eagerTotal = computeTotal();',
    ].join('\n');
    const found = await identifiersOf('src/bind.ts', source, 'typescript');
    expect(found.map((entry) => entry.name)).toStrictEqual(['loadedRecord', 'eagerTotal']);
});

test('Bash functions and variables are collected', async () => {
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

test('Python declarations are collected by category, dunder names included, self left out', async () => {
    const found = await identifiersOf('shop/orders.py', PYTHON_EXTRACTOR_SOURCE, 'python');
    expect(
        Object.fromEntries(
            Object.keys(EXPECTED_PYTHON_NAMES).map((category) => [category, namesInCategory(found, category)]),
        ),
    ).toStrictEqual(
        Object.fromEntries(Object.entries(EXPECTED_PYTHON_NAMES).map(([category, names]) => [category, [...names]])),
    );
});

test('Swift declarations are collected by category', async () => {
    const found = await identifiersOf('Sources/User.swift', SWIFT_EXTRACTOR_SOURCE, 'swift');
    expect(
        Object.fromEntries(
            Object.keys(EXPECTED_SWIFT_NAMES).map((category) => [category, namesInCategory(found, category)]),
        ),
    ).toStrictEqual(
        Object.fromEntries(Object.entries(EXPECTED_SWIFT_NAMES).map(([category, names]) => [category, [...names]])),
    );
});

test.each([...SOURCE_ORDER_CASES])(
    '$language declarations arrive in document order, including names on the same line',
    async ({ file, source, language, expected }) => {
        const found = await identifiersOf(file, source, language);
        expect(found.map(({ name }) => name)).toStrictEqual([...expected]);
        expect(found.every((identifier) => identifier.file === file && identifier.language === language)).toBe(true);
    },
);

test('JavaScript destructured and arrow parameters are declarations; object keys are not', async () => {
    const found = await identifiersOf(
        'source.js',
        'function loadValue({ account: localAccount }, [firstValue], ...remainingValues) {}\nconst readValue = inputValue => inputValue;\n',
        'javascript',
    );
    expect(found.map(({ name, category }) => ({ name, category }))).toStrictEqual([
        { name: 'loadValue', category: 'functions' },
        { name: 'localAccount', category: 'parameters' },
        { name: 'firstValue', category: 'parameters' },
        { name: 'remainingValues', category: 'parameters' },
        { name: 'readValue', category: 'variables' },
        { name: 'inputValue', category: 'parameters' },
    ]);
});

test.each([...NAME_POSITION_CASES])(
    '$language names keep their line and column; discarded names such as _ are left out',
    async ({ file, language, source, expected }) => {
        const found = await identifiersOf(file, source, language);
        expect(found.map(({ name, category, line, column }) => ({ name, category, line, column }))).toStrictEqual([
            ...expected,
        ]);
    },
);

test('shared route containers retain punctuation without changing plain paths', () => {
    const containers = readNamingDefaults(createReadCache(process.cwd())).path_containers;
    expect(fileIdentifier('app/[...slug].ts', 'typescript', containers)).toMatchObject({
        name: 'slug',
        category: 'path_parameters',
    });
    for (const name of ['(group)', '@slot', '_private'])
        expect(fileIdentifier(`app/${name}.ts`, 'typescript', containers)).toMatchObject({
            name,
            category: 'files',
        });
    expect(fileIdentifier('app/[slug].ts', 'typescript', [])).toMatchObject({ name: '[slug]', category: 'files' });
    expect(
        directoryIdentifiers('app/(group)/@slot/_private/[id]/page.ts', 'typescript', []).map(({ name }) => name),
    ).toStrictEqual(['app', '(group)', '@slot', '_private', '[id]']);
});

test('the stem drops one extension, or the whole declaration suffix', () => {
    expect(fileIdentifier('src/a-b.test.ts', 'typescript', []).name).toBe('a-b.test');
    expect(fileIdentifier('types/modules.d.ts', 'typescript', []).name).toBe('modules');
    expect(fileIdentifier('db/20240101010101_add_users.sql', 'sql', []).name).toBe('20240101010101_add_users.sql');
});

test('Next.js segments are unwrapped and dot folders skipped', () => {
    const containers = readNamingDefaults(createReadCache(process.cwd())).path_containers;
    const names = directoryIdentifiers('app/(marketing)/[slug]/@modal/_lib/.hidden/page.tsx', 'typescript', containers);
    expect(names.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
        'directories:app',
        'directories:marketing',
        'path_parameters:slug',
        'directories:modal',
        'directories:lib',
    ]);
    expect(names[2]?.directory).toBe('app/(marketing)/[slug]');
    expect(fileIdentifier('app/[...rest]/page.tsx', 'typescript', containers)).toMatchObject({
        name: 'page',
        category: 'files',
    });
});
