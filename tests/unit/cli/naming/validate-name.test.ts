import { describe, expect, test } from 'bun:test';
import { compileTerms } from '#cli/naming/match.ts';
import { shippedPolicy } from '#cli/naming/policy.ts';
import { nameProblems } from '#cli/naming/validate-name.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';
import type { EffectivePolicy, Identifier } from '#cli/types/naming.ts';

function caseFor(language: string, category: string): string[] {
    if (category === 'types') return ['pascal'];
    return language === 'bash' ? ['snake'] : ['camel'];
}

const policy: EffectivePolicy = {
    terms: compileTerms(['enhanced', 'handler'], 'marketing group'),
    reserved: new Map([['config', ['configuration directory', 'configuration variable']]]),
    external: new Set(['requestAnimationFrame']),
    allowed: new Map([['enhancedThing', 'a reason']]),
    contractProperties: new Map([['api/route.ts', new Set(['Content-Type'])]]),
    rules: [
        {
            isPath: pathMatcher(['**']),
            languages: undefined,
            categories: new Set(['variables']),
            names: new Set(['i', '_']),
            isExcluding: true,
            isDigitsAllowed: false,
            isDuplicatesAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 1',
        },
        {
            isPath: pathMatcher(['**/acceptance/**']),
            languages: undefined,
            categories: undefined,
            names: undefined,
            isExcluding: false,
            isDigitsAllowed: true,
            isDuplicatesAllowed: false,
            structuralPrefix: undefined,
            caseNames: undefined,
            source: 'shipped rule 2',
        },
        {
            isPath: pathMatcher(['**/*.sh']),
            languages: new Set(['bash']),
            categories: new Set(['functions']),
            names: undefined,
            isExcluding: false,
            isDigitsAllowed: false,
            isDuplicatesAllowed: false,
            structuralPrefix: /^_+/u,
            caseNames: undefined,
            source: 'shipped rule 3',
        },
    ],
    languages: {},
    limitsFor: (language, category) => ({
        caseNames: caseFor(language, category),
        maxChars: 20,
        maxWords: 3,
    }),
    isDigitsBanned: true,
    isDuplicatesBanned: true,
};

const plain = { policy, isReactFile: false, isTestFile: false };

function identifier(name: string, category = 'functions', file = 'src/a.ts', language = 'typescript'): Identifier {
    return { file, line: 1, column: 1, language, category, kind: `${language} ${category}`, name };
}

describe('nameProblems', () => {
    test('reports every problem a name has, with the policy source', () => {
        const rules = nameProblems(identifier('enhancedHandler2UserUser'), plain).map((problem) => problem.rule);
        expect(rules).toStrictEqual(['digits', 'length', 'words', 'duplicate-words', 'banned-term']);
        expect(
            nameProblems(identifier('enhancedHandler2UserUser'), plain).find(
                (problem) => problem.rule === 'banned-term',
            )?.source,
        ).toBe('marketing group');
    });

    test('case follows the category, and file stems are checked by dot segment', () => {
        expect(nameProblems(identifier('my_type', 'types'), plain)[0]?.rule).toBe('case');
        expect(
            nameProblems(identifier('bash.test', 'files'), {
                ...plain,
                policy: { ...policy, limitsFor: () => ({ caseNames: ['kebab'], maxChars: 35, maxWords: 4 }) },
            }),
        ).toStrictEqual([]);
    });

    test('path exclusions, digit allowances and structural prefixes apply', () => {
        expect(nameProblems(identifier('i', 'variables'), plain)).toStrictEqual([]);
        expect(nameProblems(identifier('user2', 'variables', 'tests/acceptance/a.ts'), plain)).toStrictEqual([]);
        expect(nameProblems(identifier('_private_step', 'functions', 'scripts/a.sh', 'bash'), plain)).toStrictEqual([]);
    });

    test('external names and file-specific contracts bypass naming checks', () => {
        expect(nameProblems(identifier('requestAnimationFrame'), plain)).toStrictEqual([]);
        expect(nameProblems(identifier('enhancedThing'), plain)).toStrictEqual([]);
        expect(nameProblems(identifier('Content-Type', 'properties', 'api/route.ts'), plain)).toStrictEqual([]);
        expect(
            nameProblems(identifier('Content-Type', 'properties', 'api/internal.ts'), plain).map(
                (problem) => problem.rule,
            ),
        ).toStrictEqual(['case']);
    });

    test('a reserved term is allowed only in its named uses', () => {
        expect(nameProblems(identifier('config', 'variables'), plain)).toStrictEqual([]);
        expect(nameProblems(identifier('configOf'), plain)[0]?.rule).toBe('reserved-term');
    });

    test('handle leads a name only in a React file', () => {
        expect(nameProblems(identifier('handleSubmit'), plain)[0]?.rule).toBe('callback-verb');
        expect(nameProblems(identifier('handleSubmit'), { policy, isReactFile: true, isTestFile: false })).toStrictEqual([]);
    });
});

test('the shipped terminology ban applies inside tests', () => {
    const terms = compileTerms(shippedPolicy().groups['terminology']!.terms, 'terminology group');
    const context = { ...plain, policy: { ...policy, terms }, isTestFile: true };
    for (const term of terms) {
        const problems = nameProblems(identifier(term.term, 'variables', 'tests/names.test.ts'), context);
        expect(problems.find((problem) => problem.rule === 'banned-term')).toMatchObject({
            source: 'terminology group',
        });
    }
});
