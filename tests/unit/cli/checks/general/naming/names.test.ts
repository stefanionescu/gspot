import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { TERMS } from '#tests/config/naming/settings.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { scopeView, knownSettings } from '#cli/settings/view.ts';
import { nameFindings } from '#cli/checks/general/naming/names.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { Identifier, NamingSettings } from '#cli/types/checks/general.ts';
import { allChecks, configurationManifests } from '#cli/configurations/manifests.ts';
import { splitParts, readNamingSettings } from '#cli/checks/general/naming/settings.ts';

const check = allChecks(configurationManifests().values()).get('naming/identifiers')!.check;

test('a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported', () => {
    const selected = selectConfigurations(['naming'], configurationManifests());
    const known = knownSettings(selected);
    const settings = parseSettings(settingsText(['naming'], { rules: true }));
    const view = scopeView(known, settings, selected, '');
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
    const declaration = identifier('base64User', 'variables', 'source.ts');
    expect(nameFindings(declaration, context)).toStrictEqual([]);
    expect(nameFindings({ ...declaration, name: 'base64UserUser' }, context).map(({ rule }) => rule)).toStrictEqual([
        'duplicate-words',
    ]);
    expect(
        nameFindings({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['words']);
    expect(nameFindings({ ...declaration, name: 'base64Helper' }, context).map(({ rule }) => rule)).toStrictEqual([
        'banned-term',
    ]);
    expect(nameFindings({ ...declaration, name: 'user2' }, context).map(({ rule }) => rule)).toStrictEqual(['digits']);
});

const namingSettings: NamingSettings = {
    terms: [
        { term: 'enhanced', parts: ['enhanced'], source: 'marketing group', group: 'marketing' },
        { term: 'handler', parts: ['handler'], source: 'marketing group', group: 'marketing' },
    ],
    reserved: new Map([['config', ['directories', 'variables']]]),
    rules: [
        {
            matches: buildPathMatcher(['**']),
            languages: undefined,
            categories: undefined,
            allowed: new Set(['requestAnimationFrame', 'enhancedThing']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'required API names',
        },
        {
            matches: buildPathMatcher(['api/route.ts']),
            languages: undefined,
            categories: undefined,
            allowed: new Set(['Content-Type']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'An external protocol fixes this name.',
        },
        {
            matches: buildPathMatcher(['**']),
            languages: undefined,
            categories: new Set(['variables']),
            allowed: new Set(['i', '_']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 1',
        },
        {
            matches: buildPathMatcher(['**/acceptance/**']),
            languages: undefined,
            categories: undefined,
            allowed: undefined,
            isDigitsAllowed: true,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 2',
        },
        {
            matches: buildPathMatcher(['**/*.sh']),
            languages: new Set(['bash']),
            categories: new Set(['functions']),
            allowed: undefined,
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: /^_+/u,
            caseNames: undefined,
            source: 'shipped rule 3',
        },
    ],
    limitsFor: (language, category) => ({
        caseNames: category === 'types' ? ['pascal'] : [language === 'bash' ? 'snake' : 'camel'],
        maxChars: 20,
        maxWords: 3,
    }),
    isDigitsAllowed: false,
    isRepeatAllowed: false,
};

const owned = allChecks(configurationManifests().values()).get('naming/identifiers')!;

const plain = { check: owned.check, settings: namingSettings, isTestFile: false };

function identifier(
    name: string,
    category: Identifier['category'] = 'functions',
    file = 'src/a.ts',
    language = 'typescript',
): Identifier {
    return { file, line: 1, column: 1, language, category, label: `${language} ${category}`, name };
}

test('a name reports every finding it has, with the rule source', () => {
    const rules = nameFindings(identifier('enhancedHandler2UserUser'), plain).map((finding) => finding.rule);
    expect(rules).toStrictEqual(['digits', 'length', 'words', 'duplicate-words', 'banned-term']);
    expect(
        nameFindings(identifier('enhancedHandler2UserUser'), plain).find((finding) => finding.rule === 'banned-term')
            ?.message,
    ).toEndWith('(marketing group).');
});

test('case follows the category, and file stems are checked by dot segment', () => {
    expect(nameFindings(identifier('my_type', 'types'), plain)[0]).toMatchObject({
        rule: 'case',
        message: 'typescript types "my_type": expected pascal case.',
    });
    expect(
        nameFindings(identifier('bash.test', 'files'), {
            ...plain,
            settings: {
                ...namingSettings,
                limitsFor: () => ({ caseNames: ['kebab'], maxChars: 35, maxWords: 4 }),
            },
        }),
    ).toStrictEqual([]);
});

test('path exclusions, digit allowances and ignored prefixes apply', () => {
    expect(nameFindings(identifier('_', 'variables'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('user2', 'variables', 'tests/acceptance/a.ts'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('_private_step', 'functions', 'scripts/a.sh', 'bash'), plain)).toStrictEqual([]);
});

test('allowed names and path overrides skip the naming rules', () => {
    expect(nameFindings(identifier('requestAnimationFrame'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('enhancedThing'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('Content-Type', 'properties', 'api/route.ts'), plain)).toStrictEqual([]);
    expect(
        nameFindings(identifier('Content-Type', 'properties', 'api/internal.ts'), plain).map((finding) => finding.rule),
    ).toStrictEqual(['case']);
});

test('a reserved word is allowed only in its named categories', () => {
    expect(nameFindings(identifier('config', 'variables'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('config', 'directories'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('configOf'), plain)[0]?.rule).toBe('reserved-term');
});

test('a prefix rule allows handle in functions and methods and reports it in variables', () => {
    const rule = {
        ...namingSettings.rules[4]!,
        matches: buildPathMatcher(['src/**']),
        languages: new Set(['typescript', 'javascript']),
        structuralPrefix: /^handle(?=[A-Z])/u,
        categories: new Set(['functions', 'methods']),
    };
    const selected = { ...plain, settings: { ...namingSettings, rules: [...namingSettings.rules, rule] } };
    for (const file of ['src/a.ts', 'src/a.tsx', 'src/a.js', 'src/a.jsx']) {
        for (const category of ['functions', 'methods'] as const)
            expect(nameFindings(identifier('handleSubmit', category, file), selected)).toStrictEqual([]);
        expect(nameFindings(identifier('handleSubmit', 'variables', file), selected)).toMatchObject([
            {
                rule: 'callback-verb',
                message:
                    'typescript variables "handleSubmit": "handle" starts a name only for event handlers. Name what this function does.',
            },
        ]);
    }
    expect(nameFindings(identifier('handleSubmit'), plain)).toStrictEqual([]);
    expect(nameFindings(identifier('handleSubmit', 'variables', 'other/a.ts'), selected)).toStrictEqual([]);
    expect(nameFindings(identifier('handlebar', 'variables'), selected)).toStrictEqual([]);
    for (const name of ['HandleSubmit', 'handleSubmit_now', 'handleSubmit-Now'])
        expect(nameFindings(identifier(name), selected).map(({ rule }) => rule)).toContain('case');
    expect(
        nameFindings(identifier('useSubmit', 'variables'), {
            ...selected,
            settings: { ...namingSettings, rules: [{ ...rule, structuralPrefix: /^use(?=[A-Z])/u }] },
        })[0]?.message,
    ).toContain('"use"');
});

test('the tests-group exemption follows the group, not its label', () => {
    const grouped = [{ term: 'actual', parts: ['actual'], source: 'An independently worded label', group: 'tests' }];
    const authored = [{ term: 'actual', parts: ['actual'], source: 'tests group' }];
    const context = { ...plain, isTestFile: true };
    expect(
        nameFindings(identifier('actualRoot'), { ...context, settings: { ...namingSettings, terms: grouped } }),
    ).toStrictEqual([]);
    expect(
        nameFindings(identifier('actualRoot'), { ...context, settings: { ...namingSettings, terms: authored } }),
    ).toMatchObject([
        { rule: 'banned-term', message: 'typescript functions "actualRoot": "actual" is banned (tests group).' },
    ]);
    expect(
        nameFindings(identifier('actualRoot'), { ...plain, settings: { ...namingSettings, terms: grouped } }),
    ).toMatchObject([
        {
            rule: 'banned-term',
            message: 'typescript functions "actualRoot": "actual" is banned (An independently worded label).',
        },
    ]);
});

test('a banned term matches whole words and runs of words only', () => {
    const settings = { ...namingSettings, terms: TERMS };
    const reported = (name: string) =>
        nameFindings(identifier(name), { ...plain, settings }).filter(({ rule }) => rule === 'banned-term');
    expect(reported('commonThing')[0]?.message).toContain('"common"');
    expect(reported('uncommon')).toStrictEqual([]);
    expect(reported('anEdgeCase')[0]?.message).toContain('"edge case"');
    expect(reported('edgeOfCase')).toStrictEqual([]);
    expect(reported('loadBearingWall')[0]?.message).toContain('"load-bearing"');
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
