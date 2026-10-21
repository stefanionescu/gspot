import { test, expect } from 'bun:test';
import { splitParts } from '#cli/checks/naming/settings.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { validateIdentifier } from '#cli/checks/naming/rules.ts';
import { BANNED_WORDS } from '#tests/data/checks/naming/settings.ts';

import {
    buildIdentifier,
    buildFileNaming,
    buildNamingSettings,
    buildScopeNamingSettings,
} from '#tests/setup/builders.ts';

test('a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported', () => {
    const effective = buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
    const context = buildFileNaming({ ...effective, limitsFor: () => ({ caseNames: [], maxChars: 35, maxWords: 4 }) });
    const declaration = buildIdentifier({ name: 'base64User', category: 'variables', file: 'source.ts' });
    expect(validateIdentifier(declaration, context)).toStrictEqual([]);
    expect(
        validateIdentifier({ ...declaration, name: 'base64UserUser' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['duplicate-words']);
    expect(
        validateIdentifier({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['words']);
    expect(validateIdentifier({ ...declaration, name: 'base64Helper' }, context).map(({ rule }) => rule)).toStrictEqual(
        ['banned-word'],
    );
    expect(validateIdentifier({ ...declaration, name: 'user2' }, context).map(({ rule }) => rule)).toStrictEqual([
        'digits',
    ]);
});

test('a name reports every finding it has, with the rule source', () => {
    const plain = buildFileNaming(buildNamingSettings());
    const rules = validateIdentifier(buildIdentifier({ name: 'enhancedHandler2UserUser' }), plain).map(
        (finding) => finding.rule,
    );
    expect(rules).toStrictEqual(['digits', 'length', 'words', 'duplicate-words', 'banned-word']);
    expect(
        validateIdentifier(buildIdentifier({ name: 'enhancedHandler2UserUser' }), plain).find(
            (finding) => finding.rule === 'banned-word',
        )?.message,
    ).toEndWith('(marketing group).');
});

test('case follows the category, and file stems are checked by dot segment', () => {
    const plain = buildFileNaming(buildNamingSettings());
    expect(validateIdentifier(buildIdentifier({ name: 'my_type', category: 'types' }), plain)[0]).toMatchObject({
        rule: 'case',
        message: 'typescript types "my_type": expected pascal case.',
    });
    expect(
        validateIdentifier(buildIdentifier({ name: 'bash.test', category: 'files' }), {
            ...plain,
            settings: {
                ...buildNamingSettings(),
                limitsFor: () => ({ caseNames: ['kebab'], maxChars: 35, maxWords: 4 }),
            },
        }),
    ).toStrictEqual([]);
});

test('path exclusions, digit allowances and ignored prefixes apply', () => {
    const plain = buildFileNaming(buildNamingSettings());
    expect(validateIdentifier(buildIdentifier({ name: '_', category: 'variables' }), plain)).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: 'user2', category: 'variables', file: 'tests/acceptance/a.ts' }),
            plain,
        ),
    ).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: '_private_step', category: 'functions', file: 'scripts/a.sh', language: 'bash' }),
            plain,
        ),
    ).toStrictEqual([]);
});

test('allowed names and path overrides skip the naming rules', () => {
    const plain = buildFileNaming(buildNamingSettings());
    expect(validateIdentifier(buildIdentifier({ name: 'requestAnimationFrame' }), plain)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'enhancedThing' }), plain)).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/route.ts' }),
            plain,
        ),
    ).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/internal.ts' }),
            plain,
        ).map((finding) => finding.rule),
    ).toStrictEqual(['case']);
});

test('a reserved word is allowed only in its named categories', () => {
    const plain = buildFileNaming(buildNamingSettings());
    expect(validateIdentifier(buildIdentifier({ name: 'config', category: 'variables' }), plain)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'config', category: 'folders' }), plain)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'configOf' }), plain)[0]?.rule).toBe('reserved-term');
});

test('an ignored_prefix override strips handle from function and method names in its files', () => {
    const plain = buildFileNaming(buildNamingSettings());
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
    for (const category of ['functions', 'methods', 'variables'] as const)
        expect(
            validateIdentifier(buildIdentifier({ name: 'handleSubmit', category: category }), selected),
        ).toStrictEqual([]);
    expect(
        validateIdentifier(buildIdentifier({ name: 'HandleSubmit' }), selected).map(({ rule }) => rule),
    ).toStrictEqual(['case']);
});

test('the tests-group exemption follows the group, not its label', () => {
    const plain = buildFileNaming(buildNamingSettings());
    const grouped = [{ word: 'actual', parts: ['actual'], setting: 'An independently worded label', group: 'tests' }];
    const authored = [{ word: 'actual', parts: ['actual'], setting: 'tests group' }];
    const context = { ...plain, isTestFile: true };
    expect(
        validateIdentifier(buildIdentifier({ name: 'actualRoot' }), {
            ...context,
            settings: { ...buildNamingSettings(), bannedWords: grouped },
        }),
    ).toStrictEqual([]);
    expect(
        validateIdentifier(buildIdentifier({ name: 'actualRoot' }), {
            ...context,
            settings: { ...buildNamingSettings(), bannedWords: authored },
        }),
    ).toMatchObject([
        { rule: 'banned-word', message: 'typescript functions "actualRoot": "actual" is banned (tests group).' },
    ]);
    expect(
        validateIdentifier(buildIdentifier({ name: 'actualRoot' }), {
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
    const plain = buildFileNaming(buildNamingSettings());
    const settings = { ...buildNamingSettings(), bannedWords: BANNED_WORDS };
    const listBannedWordFindings = (name: string) =>
        validateIdentifier(buildIdentifier({ name: name }), { ...plain, settings }).filter(
            ({ rule }) => rule === 'banned-word',
        );
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
