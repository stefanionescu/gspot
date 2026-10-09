import { posix } from 'node:path';
import { namingTerms } from '#cli/configurations/public.ts';
import { stemOf, compact } from '#cli/platform/contracts.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { bashIdentifiers } from '#cli/parsers/naming/bash.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { sqlIdentifiers } from '#cli/parsers/naming/public.ts';
import { swiftIdentifiers } from '#cli/parsers/naming/swift.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { splitParts } from '#cli/checks/general/naming/public.ts';
import { pythonIdentifiers } from '#cli/parsers/naming/python.ts';
import { createIdentifier } from '#cli/parsers/naming/contracts.ts';
import { CATEGORY_PARENTS } from '#cli/config/checks/general/naming.ts';
import { grammarFor, parseSource } from '#cli/parsers/source/public.ts';
import { typescriptIdentifiers } from '#cli/parsers/naming/typescript.ts';
import { tablesFor, settingValue } from '#cli/policy/settings/contracts.ts';
import type { Policy, KnownSettings, NamingSettings } from '#cli/types/policy/settings.ts';
import type { Term, PathRule, PathContainer, EffectivePolicy } from '#cli/types/checks/general/naming.ts';
import type { Identifier, NamingTerms, NamingLanguage, NamingOverride } from '#cli/types/parsers/naming.ts';

function segmentName(segment: string, containers: PathContainer[]): Pick<Identifier, 'name' | 'category'> | undefined {
    const bracket = containers.find((entry) => segment.startsWith(entry.open) && segment.endsWith(entry.close));
    if (bracket === undefined) return undefined;
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(/^\.\.\./u, ''), category: bracket.category };
}

function toSet(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

function compileRule(rule: NamingOverride, source: string): PathRule {
    return {
        matches: pathMatcher(rule.paths),
        languages: toSet(rule.languages),
        categories: toSet(rule.categories),
        names: toSet(rule.names),
        allowed: toSet(rule.allowed),
        isDigitsAllowed: rule.allow_digits === true,
        isRepeatAllowed: rule.allow_repeated_words === true,
        structuralPrefix: rule.ignored_prefix === undefined ? undefined : new RegExp(rule.ignored_prefix, 'u'),
        caseNames: rule.case,
        source,
    };
}

function reservedTerms(shipped: NamingTerms, naming: NamingSettings): Map<string, string[]> {
    const reserved = new Map<string, string[]>();
    for (const [term, categories] of Object.entries({ ...shipped.reserved, ...naming.reserved }))
        reserved.set(term.toLowerCase(), categories);
    return reserved;
}

function buildLimitsFor(
    shipped: NamingTerms,
    surface: KnownSettings,
    policy: Policy,
    scope: string,
): EffectivePolicy['limitsFor'] {
    return (language, category) => {
        const table: NamingLanguage | undefined = shipped.languages[language];
        const parent = CATEGORY_PARENTS[category] ?? category;
        const prefix = `naming.${language}`;

        const ceiling = (slot: string): number => {
            const found = [`${prefix}.${parent}.${slot}`, `${prefix}.${slot}`]
                .map((key) => settingValue(surface, policy, key, scope)?.value)
                .find((value): value is number => typeof value === 'number');
            return found ?? 0;
        };
        const cases = settingValue(surface, policy, `${prefix}.${parent}.case`, scope)?.value;
        const defaults =
            [category, parent].map((name) => table?.categories[name]?.case).find((names) => names !== undefined) ?? [];
        return {
            caseNames: Array.isArray(cases) && cases.length > 0 ? (cases as string[]) : defaults,
            maxChars: ceiling('max_chars'),
            maxWords: ceiling('max_words'),
        };
    };
}

/**
 * The file's own name as an identifier: the stem for most languages, the whole base name for a SQL migration.
 * @param path the file path
 * @param language the language configuration the file belongs to
 * @param containers the selected configurations’ path punctuation
 * @returns the identifier
 */
export function fileIdentifier(path: string, language: string, containers: PathContainer[]): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith('.sql') ? base : stemOf(base);
    const named = segmentName(
        name,
        containers.filter((container) => container.category !== 'directories'),
    ) ?? { name, category: 'files' };
    return createIdentifier({ file: path, language }, { line: 1, column: 1, ...named });
}

/**
 * Every directory on a file's path as an identifier, from the top down. Dot folders are skipped.
 * @param path the file path
 * @param language the language configuration the file belongs to
 * @param containers the selected configurations’ path punctuation
 * @returns the identifiers
 */
export function directoryIdentifiers(path: string, language: string, containers: PathContainer[]): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.')
            ? undefined
            : (segmentName(segment, containers) ?? { name: segment, category: 'directories' });
        if (named === undefined || named.name === '') return [];
        const directory = segments.slice(0, index + 1).join('/');
        return [createIdentifier({ file: path, language }, { line: 1, column: 1, ...named, directory })];
    });
}

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path
 * @param text the file text
 * @param language the language configuration the file belongs to
 * @param context optional execution reads and their resource owner
 * @returns the identifiers in document order
 */
export async function identifiersOf(
    file: string,
    text: string,
    language: string,
    context?: Pick<CheckInput, 'reads' | 'resources'>,
): Promise<Identifier[]> {
    if (language === 'sql') return sqlIdentifiers(file, text, context?.reads);
    const grammar = grammarFor(file, language);
    if (grammar === undefined) return [];
    const tree = await parseSource(grammar, text, context);
    try {
        let identifiers: Identifier[];
        switch (grammar) {
            case 'bash': {
                identifiers = bashIdentifiers(tree.rootNode, file);
                break;
            }
            case 'swift': {
                identifiers = swiftIdentifiers(tree.rootNode, file);
                break;
            }
            case 'python': {
                identifiers = pythonIdentifiers(tree.rootNode, file);
                break;
            }
            default: {
                identifiers = typescriptIdentifiers(tree.rootNode, file, language);
            }
        }
        return identifiers.toSorted((left, right) => left.line - right.line || left.column - right.column);
    } finally {
        tree.delete();
    }
}

/**
 * Compiles a term list into parts.
 * @param terms the terms as written
 * @param origin the display source and stable group, when the terms belong to a group
 * @returns the compiled terms, empty ones dropped
 */
export function compileTerms(terms: string[], origin: Pick<Term, 'source' | 'group'>): Term[] {
    return terms
        .map((term) => ({ term: term.trim().toLowerCase(), parts: splitParts(term), ...origin }))
        .filter((term) => term.parts.length > 0);
}

/**
 * The policy in force for a scope: the shipped lists with the repository's additions, exemptions, and ceilings.
 * @param surface the scope's settings surface
 * @param policy the repository policy
 * @param scope the scope path, '' for the root
 * @param manifests the selected manifests, whose naming rules follow the shipped ones
 * @returns the effective policy
 */
export function effectivePolicy(
    surface: KnownSettings,
    policy: Policy,
    scope: string,
    manifests: Pick<Manifest, 'configuration' | 'naming'>[],
): EffectivePolicy {
    const shipped = namingTerms();
    const tables = tablesFor(policy, scope).map(({ table }) => table.naming);
    const naming: NamingSettings = {
        ...policy.naming,
        banned: [...new Set(tables.flatMap((table) => table?.banned ?? []))],
        allowed: Object.fromEntries(
            tables.flatMap((table) => (table === undefined ? [] : Object.entries(table.allowed))),
        ),
        reserved: Object.fromEntries(
            tables.flatMap((table) => (table === undefined ? [] : Object.entries(table.reserved))),
        ),
        overrides: tables.flatMap((table) => table?.overrides ?? []),
    };
    const terms = [
        ...Object.entries(shipped.groups)
            .filter(([group]) => group !== 'folders')
            .flatMap(([group, { terms }]) => compileTerms(terms, { source: `${group} group`, group })),
        ...compileTerms(naming.banned, { source: 'naming.banned' }),
    ];
    // The shipped rules first, then what the selected configurations know about their own files, then the repository's.
    const rules = [
        ...shipped.overrides.map((rule, index) => compileRule(rule, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.overrides ?? []).map((rule) =>
                compileRule(compact(rule), `the ${manifest.configuration.name} configuration`),
            ),
        ),
        ...naming.overrides.map((rule, index) => compileRule(rule, `[[naming.overrides]] entry ${String(index + 1)}`)),
    ];
    return {
        terms,
        reserved: reservedTerms(shipped, naming),
        allowed: new Map([
            ...shipped.allowed.map((name) => [name, undefined] as const),
            ...Object.entries(naming.allowed),
        ]),
        rules,
        limitsFor: buildLimitsFor(shipped, surface, policy, scope),
        isDigitsAllowed: shipped.allow_digits,
        isRepeatAllowed: shipped.allow_repeated_words,
    };
}
