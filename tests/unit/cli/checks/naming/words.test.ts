import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { buildNamingSettings } from '#tests/setup/builders.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { BANNED_WORDS } from '#tests/data/checks/naming/settings.ts';
import { checkIdentifier } from '#cli/checks/general/naming/names.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';
import { type Identifier, type NamingInputs } from '#cli/types/checks/general.ts';
import { splitParts, readNamingSettings } from '#cli/checks/general/naming/settings.ts';

test('a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported', () => {
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'naming/identifiers',
    )!.check;
    const selected = selectConfigurations(['naming'], readManifests(createReadCache(process.cwd())));
    const known = buildKnownSettings(selected);
    const settings = parseSettings(
        buildSettingsText(['naming'], { rules: true }),
        undefined,
        createReadCache(process.cwd()),
    );
    const view = buildScopeView(known, settings, selected, '');
    const effective = readNamingSettings({
        selection: { view: view, scope: { path: '' }, selected: selected },
        settingsFile: { settings: settings },
        reads: createReadCache(process.cwd()),
    });
    const context = {
        check,
        settings: { ...effective, limitsFor: () => ({ caseNames: [], maxChars: 35, maxWords: 4 }) },
        isTestFile: false,
    };
    const declaration = buildIdentifier('base64User', 'variables', 'source.ts');
    expect(checkIdentifier(declaration, context)).toStrictEqual([]);
    expect(checkIdentifier({ ...declaration, name: 'base64UserUser' }, context).map(({ rule }) => rule)).toStrictEqual([
        'duplicate-words',
    ]);
    expect(
        checkIdentifier({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['words']);
    expect(checkIdentifier({ ...declaration, name: 'base64Helper' }, context).map(({ rule }) => rule)).toStrictEqual([
        'banned-word',
    ]);
    expect(checkIdentifier({ ...declaration, name: 'user2' }, context).map(({ rule }) => rule)).toStrictEqual([
        'digits',
    ]);
});

function buildNamingInputs(): NamingInputs {
    const owned = listChecksById(readManifests(createReadCache(process.cwd())).values()).get('naming/identifiers')!;
    return { check: owned.check, settings: buildNamingSettings(), isTestFile: false };
}

function buildIdentifier(
    name: string,
    category: Identifier['category'] = 'functions',
    file = 'src/a.ts',
    language = 'typescript',
): Identifier {
    return { file, line: 1, column: 1, language, category, label: `${language} ${category}`, name };
}

test('a name reports every finding it has, with the rule source', () => {
    const plain = buildNamingInputs();
    const rules = checkIdentifier(buildIdentifier('enhancedHandler2UserUser'), plain).map((finding) => finding.rule);
    expect(rules).toStrictEqual(['digits', 'length', 'words', 'duplicate-words', 'banned-word']);
    expect(
        checkIdentifier(buildIdentifier('enhancedHandler2UserUser'), plain).find(
            (finding) => finding.rule === 'banned-word',
        )?.message,
    ).toEndWith('(marketing group).');
});

test('case follows the category, and file stems are checked by dot segment', () => {
    const plain = buildNamingInputs();
    expect(checkIdentifier(buildIdentifier('my_type', 'types'), plain)[0]).toMatchObject({
        rule: 'case',
        message: 'typescript types "my_type": expected pascal case.',
    });
    expect(
        checkIdentifier(buildIdentifier('bash.test', 'files'), {
            ...plain,
            settings: {
                ...buildNamingSettings(),
                limitsFor: () => ({ caseNames: ['kebab'], maxChars: 35, maxWords: 4 }),
            },
        }),
    ).toStrictEqual([]);
});

test('path exclusions, digit allowances and ignored prefixes apply', () => {
    const plain = buildNamingInputs();
    expect(checkIdentifier(buildIdentifier('_', 'variables'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('user2', 'variables', 'tests/acceptance/a.ts'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('_private_step', 'functions', 'scripts/a.sh', 'bash'), plain)).toStrictEqual(
        [],
    );
});

test('allowed names and path overrides skip the naming rules', () => {
    const plain = buildNamingInputs();
    expect(checkIdentifier(buildIdentifier('requestAnimationFrame'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('enhancedThing'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('Content-Type', 'properties', 'api/route.ts'), plain)).toStrictEqual([]);
    expect(
        checkIdentifier(buildIdentifier('Content-Type', 'properties', 'api/internal.ts'), plain).map(
            (finding) => finding.rule,
        ),
    ).toStrictEqual(['case']);
});

test('a reserved word is allowed only in its named categories', () => {
    const plain = buildNamingInputs();
    expect(checkIdentifier(buildIdentifier('config', 'variables'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('config', 'folders'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('configOf'), plain)[0]?.rule).toBe('reserved-term');
});

test('a prefix rule allows handle in functions and methods and reports it in variables', () => {
    const plain = buildNamingInputs();
    const rule = {
        ...buildNamingSettings().overrides[4]!,
        matches: buildPathMatcher(['src/**']),
        languages: new Set(['typescript', 'javascript']),
        ignoredPrefix: /^handle(?=[A-Z])/u,
        categories: new Set(['functions', 'methods']),
    };
    const selected = {
        ...plain,
        settings: { ...buildNamingSettings(), overrides: [...buildNamingSettings().overrides, rule] },
    };
    for (const file of ['src/a.ts', 'src/a.tsx', 'src/a.js', 'src/a.jsx']) {
        for (const category of ['functions', 'methods'] as const)
            expect(checkIdentifier(buildIdentifier('handleSubmit', category, file), selected)).toStrictEqual([]);
        expect(checkIdentifier(buildIdentifier('handleSubmit', 'variables', file), selected)).toMatchObject([
            {
                rule: 'callback-verb',
                message:
                    'typescript variables "handleSubmit": "handle" starts a name only for event handlers. Name what this function does.',
            },
        ]);
    }
    expect(checkIdentifier(buildIdentifier('handleSubmit'), plain)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('handleSubmit', 'variables', 'other/a.ts'), selected)).toStrictEqual([]);
    expect(checkIdentifier(buildIdentifier('handlebar', 'variables'), selected)).toStrictEqual([]);
    for (const name of ['HandleSubmit', 'handleSubmit_now', 'handleSubmit-Now'])
        expect(checkIdentifier(buildIdentifier(name), selected).map(({ rule }) => rule)).toContain('case');
    expect(
        checkIdentifier(buildIdentifier('useSubmit', 'variables'), {
            ...selected,
            settings: { ...buildNamingSettings(), overrides: [{ ...rule, ignoredPrefix: /^use(?=[A-Z])/u }] },
        })[0]?.message,
    ).toContain('"use"');
});

test('the tests-group exemption follows the group, not its label', () => {
    const plain = buildNamingInputs();
    const grouped = [{ word: 'actual', parts: ['actual'], setting: 'An independently worded label', group: 'tests' }];
    const authored = [{ word: 'actual', parts: ['actual'], setting: 'tests group' }];
    const context = { ...plain, isTestFile: true };
    expect(
        checkIdentifier(buildIdentifier('actualRoot'), {
            ...context,
            settings: { ...buildNamingSettings(), bannedWords: grouped },
        }),
    ).toStrictEqual([]);
    expect(
        checkIdentifier(buildIdentifier('actualRoot'), {
            ...context,
            settings: { ...buildNamingSettings(), bannedWords: authored },
        }),
    ).toMatchObject([
        { rule: 'banned-word', message: 'typescript functions "actualRoot": "actual" is banned (tests group).' },
    ]);
    expect(
        checkIdentifier(buildIdentifier('actualRoot'), {
            ...plain,
            settings: { ...buildNamingSettings(), bannedWords: grouped },
        }),
    ).toMatchObject([
        {
            rule: 'banned-word',
            message: 'typescript functions "actualRoot": "actual" is banned (An independently worded label).',
        },
    ]);
});

test('a banned word matches whole words and runs of words only', () => {
    const plain = buildNamingInputs();
    const settings = { ...buildNamingSettings(), bannedWords: BANNED_WORDS };
    const listBannedWordFindings = (name: string) =>
        checkIdentifier(buildIdentifier(name), { ...plain, settings }).filter(({ rule }) => rule === 'banned-word');
    expect(listBannedWordFindings('commonThing')[0]?.message).toContain('"common"');
    expect(listBannedWordFindings('uncommon')).toStrictEqual([]);
    expect(listBannedWordFindings('anEdgeCase')[0]?.message).toContain('"edge case"');
    expect(listBannedWordFindings('edgeOfCase')).toStrictEqual([]);
    expect(listBannedWordFindings('loadBearingWall')[0]?.message).toContain('"load-bearing"');
});

test('splitParts splits at case changes, separators and digit runs; an acronym is one word', () => {
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
