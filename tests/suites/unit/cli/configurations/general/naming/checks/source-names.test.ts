import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';
import type { Identifier } from '#cli/types/configurations/naming.ts';
import { parseIdentifiers } from '#cli/configurations/general/naming/checks/source-names.ts';

import {
    BASH_SOURCE_NAMES,
    DECLARATION_CASES,
    IMPORT_NAME_LINES,
    NAME_POSITION_CASES,
    JAVASCRIPT_PARAMETER_NAMES,
} from '#tests/config/configurations/naming/source-names.ts';

async function listIdentifiers(file: string, source: string, language: string): Promise<Identifier[]> {
    using resources = createRunResources();
    const { identifiers } = await parseIdentifiers(file, source, language, {
        cache: createRunCache(process.cwd()),
        resources,
    });
    return identifiers;
}

test.each([...DECLARATION_CASES])(
    '$language declarations are collected by category',
    async ({ language, path, source, expected, absent }) => {
        const found = await listIdentifiers(path, source, language);
        const byCategory: Readonly<Record<string, readonly string[]>> = expected;
        expect(
            Object.fromEntries(
                Object.keys(byCategory).map((category) => [
                    category,
                    found.filter((identifier) => identifier.category === category).map((identifier) => identifier.name),
                ]),
            ),
        ).toStrictEqual(
            Object.fromEntries(Object.entries(byCategory).map(([category, names]) => [category, [...names]])),
        );
        for (const name of absent) expect(found.map((identifier) => identifier.name)).not.toContain(name);
    },
);
test('a name bound by require or await import is skipped, and other bindings are kept', async () => {
    const source = [...IMPORT_NAME_LINES].join('\n');
    const found = await listIdentifiers('src/bind.ts', source, 'typescript');
    expect(found.map((identifier) => identifier.name)).toStrictEqual(['loadedRecord', 'eagerTotal']);
});
test('Bash functions and variables are collected in source order', async () => {
    const found = await listIdentifiers(
        'scripts/run.sh',
        'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
        'bash',
    );
    expect(found.map((identifier) => `${identifier.category}:${identifier.name}`)).toStrictEqual([
        ...BASH_SOURCE_NAMES,
    ]);
});
test('javascript declarations arrive in document order, including names on the same line', async () => {
    const source =
        'const firstValue = 1;\nfunction loadValue(inputValue) { const innerValue = inputValue; }\nclass Book {}\n';
    const found = await listIdentifiers('source.js', source, 'javascript');
    expect(found.map(({ name }) => name)).toStrictEqual([
        'firstValue',
        'loadValue',
        'inputValue',
        'innerValue',
        'Book',
    ]);
});
test('JavaScript destructured and arrow parameters are declarations; object keys are not', async () => {
    const found = await listIdentifiers(
        'source.js',
        'function loadValue({ account: localAccount }, [firstValue], ...remainingValues) {}\nconst readValue = inputValue => inputValue;\n',
        'javascript',
    );
    expect(found.map(({ name, category }) => ({ name, category }))).toStrictEqual([...JAVASCRIPT_PARAMETER_NAMES]);
});
test.each([...NAME_POSITION_CASES])(
    '$language names keep their line and column; discarded names such as _ are left out',
    async ({ file, language, source, expected }) => {
        const found = await listIdentifiers(file, source, language);
        expect(found.map(({ name, category, line, column }) => ({ name, category, line, column }))).toStrictEqual([
            ...expected,
        ]);
    },
);
test('the settings file pyproject.toml declares no identifiers', async () => {
    const source = '[tool.comfy]\nDisplayName = "Live Shopping"\nPublisherId = "acme"\n';
    expect(await listIdentifiers('pyproject.toml', source, 'python')).toStrictEqual([]);
});
