import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { allChecks } from '#cli/configurations/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import type { EffectivePolicy } from '#cli/types/checks/general/naming.ts';
import { bannedTerm, nameFindings } from '#cli/checks/general/naming/public.ts';
import { namingTerms, configurationManifests } from '#cli/configurations/public.ts';
import { compileTerms, effectivePolicy } from '#cli/checks/general/naming/contracts.ts';

const policy: EffectivePolicy = {
    terms: compileTerms(['enhanced', 'handler'], { source: 'marketing group', group: 'marketing' }),
    reserved: new Map([['config', ['directories', 'variables']]]),
    allowed: new Map<string, string | undefined>([
        ['requestAnimationFrame', undefined],
        ['enhancedThing', 'a reason'],
    ]),
    rules: [
        {
            matches: pathMatcher(['api/route.ts']),
            languages: undefined,
            categories: undefined,
            names: undefined,
            allowed: new Set(['Content-Type']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'An external protocol fixes this name.',
        },
        {
            matches: pathMatcher(['**']),
            languages: undefined,
            categories: new Set(['variables']),
            names: new Set(['i', '_']),
            allowed: new Set(['i', '_']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 1',
        },
        {
            matches: pathMatcher(['**/acceptance/**']),
            languages: undefined,
            categories: undefined,
            names: undefined,
            allowed: undefined,
            isDigitsAllowed: true,
            isRepeatAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 2',
        },
        {
            matches: pathMatcher(['**/*.sh']),
            languages: new Set(['bash']),
            categories: new Set(['functions']),
            names: undefined,
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

const owned = allChecks(configurationManifests().values()).get('naming/identifiers');
if (owned === undefined) throw new Error('The naming/identifiers declaration is missing.');
const plain = { check: owned.check, policy, isTestFile: false };

function identifier(name: string, category = 'functions', file = 'src/a.ts', language = 'typescript'): Identifier {
    return { file, line: 1, column: 1, language, category, kind: `${language} ${category}`, name };
}

describe('nameFindings', () => {
    test('reports every finding a name has, with the policy source', () => {
        const rules = nameFindings(identifier('enhancedHandler2UserUser'), plain).map((finding) => finding.rule);
        expect(rules).toStrictEqual(['digits', 'length', 'words', 'duplicate-words', 'banned-term']);
        expect(
            nameFindings(identifier('enhancedHandler2UserUser'), plain).find(
                (finding) => finding.rule === 'banned-term',
            )?.message,
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
                policy: { ...policy, limitsFor: () => ({ caseNames: ['kebab'], maxChars: 35, maxWords: 4 }) },
            }),
        ).toStrictEqual([]);
    });

    test('path exclusions, digit allowances and structural prefixes apply', () => {
        expect(nameFindings(identifier('_', 'variables'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('user2', 'variables', 'tests/acceptance/a.ts'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('_private_step', 'functions', 'scripts/a.sh', 'bash'), plain)).toStrictEqual([]);
    });

    test('external names and file-specific contracts bypass naming checks', () => {
        expect(nameFindings(identifier('requestAnimationFrame'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('enhancedThing'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('Content-Type', 'properties', 'api/route.ts'), plain)).toStrictEqual([]);
        expect(
            nameFindings(identifier('Content-Type', 'properties', 'api/internal.ts'), plain).map(
                (finding) => finding.rule,
            ),
        ).toStrictEqual(['case']);
    });

    test('a reserved term is allowed only in its named uses', () => {
        expect(nameFindings(identifier('config', 'variables'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('config', 'directories'), plain)).toStrictEqual([]);
        expect(nameFindings(identifier('configOf'), plain)[0]?.rule).toBe('reserved-term');
    });
});

test('selected prefix rules permit functions and methods and reject variables without a file-extension exception', () => {
    const rule = {
        ...policy.rules[3]!,
        matches: pathMatcher(['src/**']),
        languages: new Set(['typescript', 'javascript']),
        structuralPrefix: /^handle(?=[A-Z])/u,
        categories: new Set(['functions', 'methods']),
    };
    const selected = { ...plain, policy: { ...policy, rules: [...policy.rules, rule] } };
    for (const file of ['src/a.ts', 'src/a.tsx', 'src/a.js', 'src/a.jsx']) {
        for (const category of ['functions', 'methods'])
            expect(nameFindings(identifier('handleSubmit', category, file), selected)).toStrictEqual([]);
        expect(nameFindings(identifier('handleSubmit', 'variables', file), selected)).toMatchObject([
            {
                rule: 'callback-verb',
                message:
                    'typescript variables "handleSubmit": "handle" leads a name only in a callback position; name what the function does.',
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
            policy: { ...policy, rules: [{ ...rule, structuralPrefix: /^use(?=[A-Z])/u }] },
        })[0]?.message,
    ).toContain('"use"');
});

test('the words of the shipped tests group pass in a test file and fail elsewhere', () => {
    const terms = Object.entries(namingTerms().groups).flatMap(([group, { terms: words }]) =>
        compileTerms(words, { source: `${group} group`, group }),
    );
    const shipped = { ...policy, terms };
    const specimen = identifier('testcaseCount', 'variables');
    expect(nameFindings(specimen, { ...plain, policy: shipped, isTestFile: true })).toStrictEqual([]);
    expect(nameFindings(specimen, { ...plain, policy: shipped, isTestFile: false })[0]?.rule).toBe('banned-term');
});

test('test exemptions use the group identity independently of its display label', () => {
    const grouped = compileTerms(['actual'], { source: 'An independently worded label', group: 'tests' });
    const authored = compileTerms(['actual'], { source: 'tests group' });
    const context = { ...plain, isTestFile: true };
    expect(nameFindings(identifier('actualRoot'), { ...context, policy: { ...policy, terms: grouped } })).toStrictEqual(
        [],
    );
    expect(
        nameFindings(identifier('actualRoot'), { ...context, policy: { ...policy, terms: authored } }),
    ).toMatchObject([
        { rule: 'banned-term', message: 'typescript functions "actualRoot": "actual" is banned (tests group).' },
    ]);
    expect(nameFindings(identifier('actualRoot'), { ...plain, policy: { ...policy, terms: grouped } })).toMatchObject([
        {
            rule: 'banned-term',
            message: 'typescript functions "actualRoot": "actual" is banned (An independently worded label).',
        },
    ]);
});

const TERMS = compileTerms(['common', 'edge case', 'load-bearing'], { source: 'test' });

describe('bannedTerm', () => {
    test('matches whole parts and consecutive parts only', () => {
        expect(bannedTerm(['common', 'thing'], TERMS)?.term).toBe('common');
        expect(bannedTerm(['uncommon'], TERMS)).toBeUndefined();
        expect(bannedTerm(['an', 'edge', 'case'], TERMS)?.term).toBe('edge case');
        expect(bannedTerm(['edge', 'of', 'case'], TERMS)).toBeUndefined();
        expect(bannedTerm(['load', 'bearing', 'wall'], TERMS)?.term).toBe('load-bearing');
    });
});

test('the required folders group keeps identifier terms separate without dropping other shipped groups', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['naming'], { level: 'all' }) });
    const session = await openSession(sandbox.path);
    const [selection] = session.scopes;
    if (selection === undefined) throw new Error('The native root selection is missing.');
    const selected = effectivePolicy(selection.view, session.policyFiles.policy, '', selection.selected);
    const expected = Object.entries(namingTerms().groups)
        .filter(([group]) => group !== 'folders')
        .flatMap(([group, { terms }]) => compileTerms(terms, { source: `${group} group`, group }));
    expect(selected.terms).toStrictEqual(expected);
    expect(selected.terms.some(({ group }) => group === 'folders')).toBe(false);
    expect(namingTerms().groups.folders.terms).toContain('shared');
    expect(
        nameFindings(identifier('sharedCount', 'variables'), { ...plain, policy: selected }).filter(
            ({ rule }) => rule === 'banned-term',
        ),
    ).toStrictEqual([]);
    expect(
        nameFindings(identifier('helperCount', 'variables'), { ...plain, policy: selected }).map(({ rule }) => rule),
    ).toContain('banned-term');
});
