import { test, expect, describe } from 'bun:test';
import { hasCase } from '#cli/parsers/naming/names.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { namingTerms } from '#cli/parsers/schema/naming.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { compileTerms } from '#cli/checks/general/naming/policy.ts';
import { nameProblems } from '#cli/checks/general/naming/problems.ts';
import type { EffectivePolicy } from '#cli/types/checks/general/naming.ts';

const policy: EffectivePolicy = {
    terms: compileTerms(['enhanced', 'handler'], 'marketing group'),
    reserved: new Map([['config', ['configuration directory', 'configuration variable']]]),
    external: new Set(['requestAnimationFrame']),
    allowed: new Map([['enhancedThing', 'a reason']]),
    fixedKeys: new Map([['api/route.ts', new Set(['Content-Type'])]]),
    rules: [
        {
            matches: pathMatcher(['**']),
            languages: undefined,
            categories: new Set(['variables']),
            names: new Set(['i', '_']),
            excludes: true,
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
            excludes: false,
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
            excludes: false,
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
    isDigitsBanned: true,
    isRepeatBanned: true,
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
        expect(nameProblems(identifier('_', 'variables'), plain)).toStrictEqual([]);
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
        expect(
            nameProblems(identifier('handleSubmit'), { policy, isReactFile: true, isTestFile: false }),
        ).toStrictEqual([]);
    });
});

test('the words of the shipped tests group pass in a test file and fail elsewhere', () => {
    const terms = Object.entries(namingTerms().groups).flatMap(([group, { terms: words }]) =>
        compileTerms(words, `${group} group`),
    );
    const shipped = { ...policy, terms };
    const actual = identifier('actualRoot', 'variables');
    expect(nameProblems(actual, { policy: shipped, isReactFile: false, isTestFile: true })).toStrictEqual([]);
    expect(nameProblems(actual, { policy: shipped, isReactFile: false, isTestFile: false })[0]?.rule).toBe(
        'banned-term',
    );
});

test('an unknown case never matches an identifier or invokes an inherited object member', () => {
    expect(hasCase('bad_name', '__proto__')).toBe(false);
    expect(hasCase('bad_name', 'camel')).toBe(false);
    expect(hasCase('goodName', 'camel')).toBe(true);
});
