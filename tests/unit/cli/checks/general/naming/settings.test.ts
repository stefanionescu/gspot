import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Identifier } from '#cli/types/checks/general.ts';
import { nameFindings } from '#cli/checks/general/naming/names.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';

import {
    NAME_WORDS,
    SCOPE_LIMITS,
    NAMING_LANGUAGES,
    SWIFT_NAMING_LIMITS,
    UPPER_SNAKE_OVERRIDE,
    LINTER_CHECKED_CATEGORIES,
} from '#tests/config/naming/settings.ts';

const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get('naming/identifiers')!.check;

test('category limits inherit root and scope language settings while explicit categories take precedence', () => {
    const selected = selectConfigurations(['naming'], readManifests(createReadCache(process.cwd())));
    const known = buildKnownSettings(selected);
    const settings = parseSettings(
        settingsText(['naming'], {
            rules: true,
            tables: SWIFT_NAMING_LIMITS,
        }),
        undefined,
        createReadCache(process.cwd()),
    );
    for (const { scope, characters, functions, words } of SCOPE_LIMITS) {
        const view = buildScopeView(known, settings, selected, scope);
        const effective = readNamingSettings({
            scope: { view: view, scope: { path: scope }, selected: selected },
            settingsFile: { settings: settings },
            reads: createReadCache(process.cwd()),
        });
        expect(effective.limitsFor('swift', 'functions')).toMatchObject({
            maxChars: functions,
            maxWords: words,
        });
        expect(effective.limitsFor('swift', 'variables')).toMatchObject({
            maxChars: characters,
            maxWords: words,
        });
    }
});

test.each([...NAMING_LANGUAGES])('%s accepts its exact limits and reports the next character or word', (language) => {
    const selected = selectConfigurations(['naming'], readManifests(createReadCache(process.cwd())));
    const known = buildKnownSettings(selected);
    const settings = parseSettings(
        settingsText(['naming'], { rules: true }),
        undefined,
        createReadCache(process.cwd()),
    );
    const view = buildScopeView(known, settings, selected, '');
    const effective = readNamingSettings({
        scope: { view: view, scope: { path: '' }, selected: selected },
        settingsFile: { settings: settings },
        reads: createReadCache(process.cwd()),
    });
    const category = language === 'swift' || language === 'sql' ? 'functions' : 'variables';
    const { maxChars: characters, maxWords: words } = effective.limitsFor(language, category);
    const context = { check, settings: effective, isTestFile: false };
    const declaration: Identifier = {
        file: 'source',
        language,
        category,
        label: category,
        name: 'z'.repeat(characters),
        line: 1,
        column: 1,
    };
    expect(nameFindings(declaration, context)).toStrictEqual([]);
    expect(
        nameFindings({ ...declaration, name: 'z'.repeat(characters + 1) }, context).map(({ rule }) => rule),
    ).toStrictEqual(['length']);
    const separator = ['python', 'bash', 'sql'].includes(language) ? '_' : '';
    const parts = NAME_WORDS.map((word, index) =>
        separator === '' && index > 0 ? word.slice(0, 1).toUpperCase() + word.slice(1) : word,
    );
    expect(nameFindings({ ...declaration, name: parts.slice(0, words).join(separator) }, context)).toStrictEqual([]);
    expect(
        nameFindings({ ...declaration, name: parts.slice(0, words + 1).join(separator) }, context).map(
            ({ rule }) => rule,
        ),
    ).toStrictEqual(['words']);
});

test.each([...LINTER_CHECKED_CATEGORIES])(
    "$language $category: the language's own linter owns case and length; word limits still apply",
    ({ language, category, native }) => {
        const selected = selectConfigurations(['naming'], readManifests(createReadCache(process.cwd())));
        const known = buildKnownSettings(selected);
        const settings = parseSettings(
            settingsText(['naming'], {
                rules: true,
                level: 'all',
                tables: UPPER_SNAKE_OVERRIDE,
            }),
            undefined,
            createReadCache(process.cwd()),
        );
        const effective = readNamingSettings({
            scope: { view: buildScopeView(known, settings, selected, ''), scope: { path: '' }, selected: selected },
            settingsFile: { settings: settings },
            reads: createReadCache(process.cwd()),
        });
        const context = { check, settings: effective, isTestFile: false };
        const identifier: Identifier = {
            file: 'source',
            language,
            category,
            label: category,
            name: 'a'.repeat(41),
            line: 1,
            column: 1,
        };
        expect(nameFindings(identifier, context).map(({ rule }) => rule)).toStrictEqual(
            native ? [] : ['case', 'length'],
        );
        expect(nameFindings({ ...identifier, name: NAME_WORDS.join('_') }, context).map(({ rule }) => rule)).toContain(
            'words',
        );
    },
);
const manifests = readManifests(createReadCache(process.cwd()));

test("a framework's naming rules come after the shipped ones and before the repository's", () => {
    const text = settingsText(['typescript', 'express'], {
        rules: true,
        tables: '[naming]\nbanned_words = ["handle", "use"]\n[[naming.override]]\npaths = ["src/hooks/**"]\ncategories = ["functions"]\nignored_prefix = "^use(?=[A-Z])"\nreason = "A hook starts with use."\n',
    });
    const settings = parseSettings(text, undefined, createReadCache(process.cwd()));
    const selected = selectConfigurations(['naming', 'typescript', 'express'], manifests);
    const effective = readNamingSettings({
        scope: {
            view: buildScopeView(buildKnownSettings(selected), settings, selected, ''),
            scope: { path: '' },
            selected,
        },
        settingsFile: { settings: settings },
        reads: createReadCache(process.cwd()),
    });
    const declaration: Identifier = {
        file: 'src/routes/auth.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        label: 'function',
        name: 'handleLogin',
    };
    const context = { check, settings: effective, isTestFile: false };
    expect(nameFindings(declaration, context)).toStrictEqual([]);
    expect(nameFindings({ ...declaration, file: 'src/hooks/login.ts', name: 'useLogin' }, context)).toStrictEqual([]);
    expect(
        nameFindings({ ...declaration, file: 'src/routes/login.ts', name: 'useLogin' }, context).map(
            ({ rule }) => rule,
        ),
    ).toContain('banned-term');
    expect(
        nameFindings({ ...declaration, file: 'src/app.py', language: 'python', name: 'handle_login' }, context).map(
            ({ rule }) => rule,
        ),
    ).toContain('banned-term');
});
