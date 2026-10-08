// Language ceilings, ordinary domain terms and technical digit words retain adjacent naming checks.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { allChecks } from '#cli/configurations/declarations.ts';
import type { KnownSettings } from '#cli/types/policy/settings.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { nameFindings } from '#cli/checks/general/naming/findings.ts';
import { effectivePolicy } from '#cli/checks/general/naming/policy.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { settingValue, declarationFor } from '#cli/policy/settings/lookup.ts';

import {
    NAME_WORDS,
    DOMAIN_SOURCE,
    SCOPE_CEILINGS,
    TECHNICAL_NAMES,
    NAMING_LANGUAGES,
    NAMING_CATEGORIES,
    NATIVE_NAME_CATEGORIES,
} from '#tests/config/cli/checks/naming.ts';

const owned = allChecks(configurationManifests().values()).get('naming/identifiers');
if (owned === undefined) throw new Error('The naming/identifiers declaration is missing.');
const check = owned.check;

function namingCeiling(settings: KnownSettings, key: string): number {
    const declaration = declarationFor(settings, key)?.declaration;
    const value = declaration === undefined ? undefined : settings.defaults.get(declaration.name)?.value;
    if (typeof value !== 'number') throw new Error(`The naming ceiling ${key} has no numeric default.`);
    return value;
}

function defaultNamingContext() {
    const selected = selectConfigurations(['naming'], configurationManifests());
    const settings = knownSettings(selected);
    const policy = parseStrictPolicy(buildPolicy(['naming']));
    return { settings, effective: effectivePolicy(settings, policy, '', selected) };
}

test.each(['recommended', 'all'] as const)('each language owns its effective ceilings at %s', (level) => {
    const selected = selectConfigurations(['naming'], configurationManifests());
    const settings = knownSettings(selected, level);
    const policy = parseStrictPolicy(buildPolicy(['naming'], { level }));
    const effective = effectivePolicy(settings, policy, '', selected);
    for (const language of NAMING_LANGUAGES) {
        const characters = namingCeiling(settings, `naming.${language}.max_chars`);
        const words = namingCeiling(settings, `naming.${language}.max_words`);
        for (const category of ['files', 'functions', 'parameters', 'variables']) {
            expect(settingValue(settings, policy, `naming.${language}.${category}.max_chars`)?.value).toBe(characters);
            expect(settingValue(settings, policy, `naming.${language}.${category}.max_words`)?.value).toBe(words);
            expect(effective.limitsFor(language, category)).toMatchObject({ maxChars: characters, maxWords: words });
        }
    }
});

test('category ceilings inherit root and scope language settings while explicit categories take precedence', () => {
    const selected = selectConfigurations(['naming'], configurationManifests());
    const settings = knownSettings(selected);
    const policy = parseStrictPolicy(
        buildPolicy(['naming'], {
            tables:
                '[naming.swift]\nmax_chars = 38\nmax_words = 4\n[naming.swift.functions]\nmax_chars = 37\n' +
                '[scope."app"]\n[scope."app".naming.swift]\nmax_chars = 36\nmax_words = 3\n' +
                '[scope."app".naming.swift.functions]\nmax_chars = 35\n[scope."sibling"]\n',
        }),
    );
    for (const { scope, characters, functions, words } of SCOPE_CEILINGS) {
        const effective = effectivePolicy(settings, policy, scope, selected);
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

test.each([...NAMING_LANGUAGES])('%s accepts its exact ceilings and reports the next character or word', (language) => {
    const { settings, effective } = defaultNamingContext();
    const characters = namingCeiling(settings, `naming.${language}.max_chars`);
    const words = namingCeiling(settings, `naming.${language}.max_words`);
    const context = { check, policy: effective, isTestFile: false, isReactFile: false };
    const category = language === 'swift' ? 'functions' : 'variables';
    const declaration: Identifier = {
        file: 'source',
        language,
        category,
        kind: category,
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

test('technical digit words remain words in every identifier category without exempting other checks', () => {
    const { effective } = defaultNamingContext();
    const context = {
        check,
        policy: { ...effective, limitsFor: () => ({ caseNames: [], maxChars: 35, maxWords: 4 }) },
        isReactFile: false,
        isTestFile: false,
    };
    for (const category of NAMING_CATEGORIES) {
        for (const name of TECHNICAL_NAMES) {
            const identifier: Identifier = {
                file: 'source.ts',
                language: 'typescript',
                category,
                kind: category,
                name,
                line: 1,
                column: 1,
            };
            expect(nameFindings(identifier, context)).toStrictEqual([]);
        }
    }
    const declaration: Identifier = {
        file: 'source.ts',
        language: 'typescript',
        category: 'variables',
        kind: 'variable',
        name: 'base64UserUser',
        line: 1,
        column: 1,
    };
    expect(nameFindings(declaration, context).map(({ rule }) => rule)).toStrictEqual(['duplicate-words']);
    expect(
        nameFindings({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['words']);
    expect(nameFindings({ ...declaration, name: 'base64Helper' }, context).map(({ rule }) => rule)).toStrictEqual([
        'banned-term',
    ]);
    expect(nameFindings({ ...declaration, name: 'user2' }, context).map(({ rule }) => rule)).toStrictEqual(['digits']);
});

test('public checks accept ordinary domain terms and numeric words in JavaScript and TypeScript', async () => {
    await using sandbox = await testdir();
    const technical = TECHNICAL_NAMES.map((name) => `export const ${name} = 1;\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'typescript', 'naming'], { level: 'all' }),
        'i18n/sha256.js': DOMAIN_SOURCE + technical,
        'categories/base64.ts': DOMAIN_SOURCE + technical,
        'entry.ts': 'export const user2 = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: 1, column: 14, rule: 'digits' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.ts'), 'export const userCount = 1;\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/identifiers', status: 'passed', findings: [] },
        { check: 'naming/paths', status: 'passed', findings: [] },
    ]);
});

test('public explanations report Swift and SQL category defaults and scoped overrides', async () => {
    const settings = knownSettings(selectConfigurations(['naming'], configurationManifests()));
    const swift = namingCeiling(settings, 'naming.swift.functions.max_chars');
    const sql = namingCeiling(settings, 'naming.sql.files.max_words');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['naming'], {
            level: 'all',
            tables: `[scope."app"]\n[scope."app".naming.swift]\nmax_chars = ${(swift - 2).toString()}\n`,
        }),
        'entry.sh': 'echo example\n',
        'app/entry.sh': 'echo example\n',
    });
    for (const [key, shipped, child] of [
        ['naming.swift.functions.max_chars', swift, swift - 2],
        ['naming.sql.files.max_words', sql, sql],
    ] as const) {
        const explained = await runGspot(sandbox.path, ['explain', key, '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({
            kind: 'setting',
            scopes: [
                { scope: '', default: shipped, current: shipped },
                { scope: 'app', default: shipped, current: child },
            ],
        });
    }
});

test.each(NATIVE_NAME_CATEGORIES)(
    '$language $category case and length follow native ownership while word limits remain',
    ({ language, category, native }) => {
        const selected = selectConfigurations(['naming'], configurationManifests());
        const settings = knownSettings(selected);
        const policy = parseStrictPolicy(
            buildPolicy(['naming'], {
                level: 'all',
                tables: '[[naming.overrides]]\npaths = ["source"]\ncase = ["upper-snake"]\nreason = "The authored interface selects this case."\n',
            }),
        );
        const effective = effectivePolicy(settings, policy, '', selected);
        const context = { check, policy: effective, isTestFile: false, isReactFile: false };
        const identifier: Identifier = {
            file: 'source',
            language,
            category,
            kind: category,
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
