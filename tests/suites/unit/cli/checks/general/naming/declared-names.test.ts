import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Identifier } from '#cli/types/checks/general/naming.ts';
import { parseIdentifiers } from '#cli/checks/general/naming/declared-names.ts';

import {
    DECLARATION_CASES,
    SETTINGS_FILE_CASES,
    NAME_POSITION_CASES,
    BASH_DECLARED_NAMES,
    DECLARED_IMPORT_LINES,
    DECLARATION_ORDER_CASES,
    JAVASCRIPT_PARAMETER_NAMES,
} from '#tests/config/checks/general/naming/declared-names.ts';

/** Parse one source and dispose its parser resources. */
async function listIdentifiers(file: string, source: string, language: string): Promise<Identifier[]> {
    using resources = new DisposableStack();
    const { identifiers } = await parseIdentifiers(file, source, language, {
        reads: createReadCache(process.cwd()),
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
                    found.filter((entry) => entry.category === category).map((entry) => entry.name),
                ]),
            ),
        ).toStrictEqual(
            Object.fromEntries(Object.entries(byCategory).map(([category, names]) => [category, [...names]])),
        );
        for (const name of absent) expect(found.map((entry) => entry.name)).not.toContain(name);
    },
);
test('a name bound by require or await import is skipped, and other bindings are kept', async () => {
    const source = [...DECLARED_IMPORT_LINES].join('\n');
    const found = await listIdentifiers('src/bind.ts', source, 'typescript');
    expect(found.map((entry) => entry.name)).toStrictEqual(['loadedRecord', 'eagerTotal']);
});
test('Bash functions and variables are collected in source order', async () => {
    const found = await listIdentifiers(
        'scripts/run.sh',
        'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
        'bash',
    );
    expect(found.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([...BASH_DECLARED_NAMES]);
});
test.each([...DECLARATION_ORDER_CASES])(
    '$language declarations arrive in document order, including names on the same line',
    async ({ file, source, language, expected }) => {
        const found = await listIdentifiers(file, source, language);
        expect(found.map(({ name }) => name)).toStrictEqual([...expected]);
        expect(found.map((identifier) => [identifier.file, identifier.language])).toStrictEqual(
            expected.map(() => [file, language]),
        );
    },
);
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
test.each([...SETTINGS_FILE_CASES])(
    'the settings file %s of the %s configuration declares no identifiers',
    async (path, language, source) => {
        const identifiers = await listIdentifiers(path, source, language);
        expect(identifiers).toStrictEqual([]);
    },
);
