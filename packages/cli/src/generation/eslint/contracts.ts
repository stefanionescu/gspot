import { posix } from 'node:path';
import { isRecord } from '#cli/platform/contracts.ts';
import { activeIgnores } from '#cli/policy/settings/public.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import type { ResolvedSelector } from '#cli/types/generation/fragments.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { everyTable, policyValue } from '#cli/policy/settings/contracts.ts';
import { byScopeDepth, nestedScopes, pathExpressions } from '#cli/repository/paths/public.ts';
import { selectorGroups, eslintNodePatterns, eslintSourcePattern } from '#cli/generation/eslint/public.ts';

import {
    LINT_CHECK,
    IMPORT_EXTENSIONS,
    ALIAS_IMPORT_SELECTORS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/generation/eslint.ts';
import type {
    EslintBlock,
    EslintContext,
    SelectorGroup,
    EslintRuleBlock,
    EslintRuleOptions,
    ScopeEslintSettings,
} from '#cli/types/generation/eslint.ts';

// The paths a loosening setting allows: every entry's paths, in the order written.
function allowedPaths(selection: ScopeSelection, setting: string): string[] {
    const value = selection.view.settings[setting];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: unknown) => {
        const paths = isRecord(entry) ? entry['paths'] : undefined;
        return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
    });
}

/**
 * Build native option declarations and ordered path overrides, each bounded by its owning scope.
 * @param policy the repository policy
 * @returns one option block per scope and path override, in application order
 */
export function eslintRuleOptions(policy: Policy): EslintRuleOptions[] {
    const tables = everyTable(policy).toSorted((first, second) => byScopeDepth(first.scope ?? '', second.scope ?? ''));
    const settings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const base = settings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined ? [] : [{ scope, ...pathExpressions(['**/*']), rules: settings.rules }],
    );
    const overrides = settings.flatMap(({ scope, settings }) =>
        (settings.overrides ?? []).map(({ paths, rules }) => ({ scope, ...pathExpressions(paths), rules })),
    );
    return [...base, ...overrides];
}

/**
 * Apply accepted findings after generated defaults and native option declarations.
 * @param policy the repository policy
 * @returns explicit rule ignores with their path selectors
 */
export function eslintIgnoreBlocks(policy: Policy): EslintRuleBlock[] {
    return activeIgnores(policy).flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== LINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...pathExpressions(
                          entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths,
                      ),
                      rules: { [entry.rule]: 'off' },
                  },
              ],
    );
}

/**
 * The per-scope rule blocks that carry the trivial-statement ceiling into the structural plugin rules.
 * @param input the resolved scopes, structural policy, and detected authored Node paths
 * @returns disabled rules at recommended, otherwise one block per scope and language, shallowest first
 */
export function structuralRuleBlocks(input: Pick<EslintContext, 'scopes' | 'policy' | 'nodeFiles'>): EslintRuleBlock[] {
    const { scopes, policy, nodeFiles } = input;
    const blocks: EslintRuleBlock[] = [];
    if (policy.level !== 'all')
        return [
            {
                scope: '',
                ...pathExpressions(['**/*']),
                rules: { 'gspot/no-trivial-files': 'off', 'gspot/no-trivial-functions': 'off' },
            },
        ];
    for (const selection of scopes.toSorted((a, b) => byScopeDepth(a.scope.path, b.scope.path))) {
        for (const [language, patterns] of [
            ['javascript', ['**/*.{js,mjs,cjs,jsx}', ...eslintNodePatterns(nodeFiles, selection.scope.path)]],
            ['typescript', ['**/*.{ts,tsx,mts,cts,vue,svelte,astro}']],
        ] as const) {
            const maxStatements = selection.view.limit('min_function_statements', language);
            const options = maxStatements === undefined ? {} : { maxStatements };
            blocks.push({
                scope: selection.scope.path,
                ...pathExpressions([...patterns]),
                rules: {
                    'gspot/no-trivial-files': [
                        'error',
                        {
                            ...options,
                            allowIndex: policy.structure.reexports === 'index-only',
                        },
                    ],
                    'gspot/no-trivial-functions': ['error', options],
                },
            });
        }
    }
    return blocks;
}

/**
 * The blocks that turn off reasoned manifest exclusions after structural defaults and before authored policy.
 * @param scopes the selected configurations and their owning scopes.
 * @param policy the effective root policy.
 * @returns scoped rule blocks that exclude every nested scope.
 */
export function manifestRuleBlocks(scopes: ScopeSelection[], policy: Policy): EslintRuleBlock[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        const children = nestedScopes(
            scopes.map((entry) => entry.scope.path),
            scope,
        );
        const excluded = children.map((path) => `!${path}/**`);
        return selection.selected
            .flatMap((manifest) => manifest.eslint_rules_off)
            .filter(
                ({ when: condition }) =>
                    condition === undefined ||
                    (selection.view.settings[condition.setting] ?? policyValue(policy, condition.setting)?.value) ===
                        condition.value,
            )
            .map(({ files, rules }) => ({
                scope,
                ...pathExpressions([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

/**
 * Resolve the actual selectors contributed by selected fragments within each project scope.
 * @param scopes every resolved project scope
 * @param target the root tool file whose selected declarations contribute selectors
 * @param isAll whether house style selectors apply
 * @returns selector groups with their owning scope and excluded child projects
 */
export function fragmentSelectorGroups(
    scopes: ScopeSelection[],
    target: ToolFileDeclaration,
    isAll: boolean,
): SelectorGroup[] {
    return scopes.flatMap((scope) => {
        const declarations = scope.selected.flatMap((manifest) =>
            manifest.toolFiles
                .filter((toolFile) => toolFile.target === target.target)
                .flatMap((toolFile) => toolFile.selectors),
        );
        const enabled = declarations.filter(
            (entry) =>
                isAll && (entry.when === undefined || scope.view.settings[entry.when.setting] === entry.when.value),
        );
        const resolved: ResolvedSelector[] = [...new Map(enabled.map((entry) => [entry.selector, entry])).values()].map(
            (entry) => {
                const files =
                    entry.role === undefined
                        ? entry.files?.map((path) => posix.join(scope.scope.path, path))
                        : Object.entries(scope.view.roles).flatMap(([name, paths]) =>
                              name === entry.role && paths !== undefined ? [paths].flat() : [],
                          );
                return {
                    selector: entry.selector,
                    message: entry.message,
                    ...(files === undefined ? {} : { files }),
                    except: [
                        ...(entry.ignores ?? []).map((path) => posix.join(scope.scope.path, path)),
                        ...(entry.allowed === undefined ? [] : allowedPaths(scope, entry.allowed)),
                    ],
                };
            },
        );
        const styles = scope.view.values['tools.eslint']?.import_extensions;
        const entries = styles === undefined ? [] : Object.entries(styles);
        for (const [index, [pattern, style]] of entries.entries())
            resolved.push({
                ...ALIAS_IMPORT_SELECTORS[style === 'extensionless' ? 'never' : 'always'],
                ...(pattern === '**/*' ? {} : { files: [pattern] }),
                except: entries.slice(index + 1).map(([path]) => path),
            });
        return selectorGroups(resolved).map((group) => ({
            ...group,
            scope: scope.scope.path,
            ignoredScopes: nestedScopes(
                scopes.map((entry) => entry.scope.path),
                scope.scope.path,
            ),
        }));
    });
}

/**
 * Build native relative-import rules for each resolved scope and ordered path style.
 * @param scopes selected scopes with their resolved import styles
 * @param nodeFiles authored files selected for Node.js execution
 * @returns native rule and TypeScript-extension settings bounded by scope
 */
export function importStyleBlocks(scopes: ScopeSelection[], nodeFiles: string[]): EslintBlock[] {
    return scopes.flatMap((entry) => {
        const path = entry.scope.path;
        const children = nestedScopes(
            scopes.map(({ scope }) => scope.path),
            path,
        );
        const styles = entry.view.values['tools.eslint']?.import_extensions;
        return styles === undefined
            ? []
            : Object.entries(styles).map(([glob, style]) => ({
                  files: [eslintSourcePattern('javascript', 'typescript'), ...eslintNodePatterns(nodeFiles, path)].map(
                      (pattern) => [path === '' ? '**/*' : `${path}/**/*`, glob, pattern],
                  ),
                  ignores: children.map((child) => `${child}/**`),
                  settings: {
                      n: {
                          tryExtensions: IMPORT_EXTENSIONS,
                          typescriptExtensionMap: style === 'js' ? TYPESCRIPT_EXTENSION_MAP : [],
                      },
                  },
                  rules: {
                      'n/file-extension-in-import': ['error', style === 'extensionless' ? 'never' : 'always'],
                  },
              }));
    });
}
