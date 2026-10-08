import { isDeepStrictEqual } from 'node:util';
import { readAsset } from '#cli/platform/root/public.ts';
import { npmPins } from '#cli/configurations/contracts.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ESLINT_RULE_NAMES_FILE } from '#cli/config/generation/eslint.ts';
import { extensionsTagged } from '#cli/repository/discovery/contracts.ts';
import type { ResolvedSelector } from '#cli/types/generation/fragments.ts';
import type { EslintPresets, EslintRuleNames } from '#cli/types/parsers/eslint.ts';
import { isInScope, literalGlob, pathMatcher } from '#cli/repository/paths/public.ts';
import { eslintPresetsSchema, eslintRuleNamesSchema } from '#cli/parsers/schema/public.ts';

import type {
    EslintFiles,
    EslintModule,
    SelectorGroup,
    EslintFileInputs,
    EslintModuleInput,
    EslintFileSelector,
    EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

function selectorSource(selector: EslintFileSelector): string {
    if (typeof selector === 'string') return JSON.stringify(selector);
    if ('component' in selector)
        return `componentMatches(${selector.component}Parser, ${JSON.stringify(selector.component)})`;
    if ('runtime' in selector) return `runtimeMatches(${String(selector.runtime.index)})`;
    return `policyMatches(${JSON.stringify(selector.scope)})`;
}

function distinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Calculate the exact file sets shared by base blocks and every framework fragment.
 * @param input selected components, detected Node files, and authored test or script patterns
 * @returns code patterns and intersections that exclude non-code files
 */
export function eslintFilePatterns(input: EslintFileInputs): EslintFiles {
    const { tests, scripts, nodeFiles } = input;
    const source = eslintSourcePattern('javascript', 'typescript');
    const matchesSource = pathMatcher([source]);
    const selected = input.components.flatMap(({ configuration, tools }) =>
        tools
            .flatMap(({ eslint }) => eslint?.extensions ?? [])
            .filter((extension) => !matchesSource(`component${extension}`))
            .map((extension) => ({ pattern: `**/*${extension}`, configuration: configuration.name })),
    );
    const components = selected.map(({ pattern }) => pattern);
    const covered = pathMatcher([source, ...components]);
    const node = eslintNodePatterns(
        nodeFiles.filter((path) => !covered(path)),
        '',
    );
    const code = [source, ...components, ...node];
    const typescript = eslintSourcePattern('typescript');
    const javascript = eslintSourcePattern('javascript');
    return {
        code,
        fragmentFiles: components,
        typescriptSource: [typescript],
        typescript: [
            typescript,
            ...selected.map(({ pattern, configuration }): EslintFiles['typescript'][number] =>
                configuration === 'vue' || configuration === 'svelte'
                    ? [pattern, { component: configuration }]
                    : pattern,
            ),
        ],
        javascript: [javascript, ...node],
        tests: tests.flatMap((test) => code.map((pattern) => [test, pattern])),
        scripts: scripts.flatMap((script) => code.map((pattern) => [script, pattern])),
    };
}

/**
 * Serialize the same rule and applicability fields retained in the generation baseline.
 * @param block the actual ESLint rule fields
 * @param runtime plugin, parser, and settings expressions that contain no rule fields
 * @returns a JavaScript configuration block
 */
export function serializeEslintBlock(block: EslintSettingsBlock, runtime = ''): string {
    const { files, ...fields } = block;
    const parts = runtime === '' ? [] : [runtime];
    parts.push(...Object.entries(fields).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`));
    if (files !== undefined) {
        const expressions = files.map((entry) => {
            if (!Array.isArray(entry)) return selectorSource(entry);
            const sources = entry.map((selector) => selectorSource(selector)).join(', ');
            return `[${sources}]`;
        });
        parts.push(`files: [${expressions.join(', ')}]`);
    }
    return `{${parts.join(', ')}}`;
}

/**
 * Bind default block emission to its level and optional project scope.
 * @param input the level, generated file selectors, authored options, and optional fragment scope
 * @returns emitted defaults and their identical ordered rule data
 */
export function eslintModule(input: EslintModuleInput): EslintModule {
    const { allRules, isAll, codeFiles, ruleOptions, scope } = input;
    const blocks: EslintSettingsBlock[] = [];
    return {
        blocks,
        block: (payload, runtime) => {
            const rules: Record<string, unknown> = Object.fromEntries(
                (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
                    name,
                    !isAll && allRules.has(name) ? 'off' : value,
                ]),
            );
            const nested =
                scope === undefined
                    ? {}
                    : {
                          files: (payload.files ?? codeFiles).map((entry) => [
                              ...(Array.isArray(entry) ? entry : [entry]),
                              scope.path === '' ? '**/*' : `${scope.path}/**/*`,
                          ]),
                          ignores: [...(payload.ignores ?? []), ...scope.excluded],
                      };
            const block = { ...payload, ...nested, rules };
            const configured = ruleOptions.flatMap((options): EslintSettingsBlock[] => {
                const entries = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
                    const chosen = options.rules[name];
                    const severity: unknown = Array.isArray(value) ? value[0] : value;
                    return chosen === undefined || severity === 'off' || severity === 0
                        ? []
                        : [[name, [severity, ...chosen]]];
                });
                if (entries.length === 0) return [];
                const matches = {
                    scope: { scope: options.scope, includes: options.includes, excludes: options.excludes, flags: 's' },
                };
                const selectedRules: Record<string, unknown> = Object.fromEntries<unknown>(entries);
                return [
                    {
                        ...block,
                        files: (block.files ?? codeFiles).map((entry) => [
                            ...(Array.isArray(entry) ? entry : [entry]),
                            matches,
                        ]),
                        rules: selectedRules,
                    },
                ];
            });
            const emitted = [block, ...configured];
            blocks.push(...emitted);
            return emitted
                .map((entry, index) => {
                    const source = serializeEslintBlock(entry, index === 0 ? runtime : '');
                    return scope === undefined ? source : `stripRuntimeGlobals(${source})`;
                })
                .join(',\n');
        },
    };
}

/**
 * Preserve every preset option while promoting enabled warnings to errors.
 * @param rules the actual rules from a pinned preset
 * @returns error settings, with disabled rules retained
 */
export function eslintErrorRules(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => {
            const entries: unknown[] = Array.isArray(entry) ? entry : [entry];
            const [level, ...options] = entries;
            return [rule, level === 'off' || level === 0 ? 'off' : ['error', ...options]];
        }),
    );
}

/**
 * Preserve each rule's ordered declarations and exact file selectors before serialization.
 * @param blocks the configuration blocks in their emitted order
 * @returns the rules table consumed by the managed generation baseline
 */
export function eslintRuleSettings(blocks: EslintSettingsBlock[]): { rules: Record<string, unknown[]> } {
    const rules: Record<string, unknown[]> = {};
    for (const block of blocks) {
        const { rules: entries, ...selectors } = block;
        for (const [name, setting] of entries === undefined ? [] : Object.entries(entries)) {
            rules[name] ??= [];
            rules[name].push({ ...selectors, setting });
        }
    }
    return { rules };
}

/**
 * One ESLint brace glob for the source extensions the inventory assigns to the requested languages.
 * @param languages the inventory language tags
 * @returns the repository-relative file pattern
 */
export function eslintSourcePattern(...languages: string[]): string {
    return `**/*.{${extensionsTagged(...languages)
        .map((extension) => extension.slice(1))
        .join(',')}}`;
}

/**
 * Escape detected Node paths for native glob selectors within one project scope.
 * @param paths the repository-relative authored Node file paths
 * @param scope the scope whose authored files are being selected
 * @returns literal native file patterns that cannot select neighboring filenames
 */
export function eslintNodePatterns(paths: string[], scope: string): string[] {
    return paths.filter((path) => isInScope(path, scope)).map((path) => literalGlob(path));
}

/**
 * Read the exact pinned presets shipped beside their configuration.
 * @param manifest the configuration owning the preset
 * @returns preset blocks without executable plugin or parser objects
 */
export function readEslintPresets(manifest: Manifest): EslintPresets {
    return eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.dir}/eslint-presets.json`)));
}

/**
 * Read actual core rule names without loading an installed ESLint runtime.
 * @returns the pinned catalog used by raw-ID explanations and build validation
 */
export function readEslintRuleNames(): EslintRuleNames {
    return eslintRuleNamesSchema.parse(JSON.parse(readAsset(ESLINT_RULE_NAMES_FILE)));
}

/**
 * Reject presets whose package, pin, or preset source does not match the shipped manifests.
 * @param manifests every shipped configuration
 */
export function validateEslintPresets(manifests: Map<string, Manifest>): void {
    const versions = npmPins([...manifests.values()], undefined);
    const presets = readEslintRuleNames();
    if (presets.version !== versions['eslint'])
        throw new Error(`Refresh the core rule names: the catalog must use eslint@${String(versions['eslint'])}.`);
    for (const manifest of [...manifests.values()].filter((entry) => Object.keys(entry.eslint_presets).length > 0)) {
        const configuration = manifest.configuration.name;
        const sources = manifest.eslint_presets;
        const presets = readEslintPresets(manifest);
        if (!isDeepStrictEqual(new Set(Object.keys(presets)), new Set(Object.keys(sources))))
            throw new Error(`Refresh the ${configuration} ESLint presets: the source exports changed.`);
        const invalid = Object.entries(sources).find(([name, { package: packageName, source }]) => {
            const preset = presets[name];
            return !isDeepStrictEqual(
                { package: preset?.package, source: preset?.source, version: preset?.version },
                { package: packageName, source, version: versions[packageName] },
            );
        });
        if (invalid !== undefined) {
            const [name, { package: packageName }] = invalid;
            throw new Error(
                `Refresh ${configuration}/${name}: its ESLint preset must use ${packageName}@${String(versions[packageName])}.`,
            );
        }
    }
}

/**
 * Groups the selectors the selected fragments add so each file set gets one no-restricted-syntax rule.
 *
 * A selector without files applies to every code file. A selector with an allowed setting is left out of the group for
 * the paths that setting names. File and allowed-path intersections produce exclusive native blocks,
 * each retaining every selector that applies there in first-mention order.
 * @param selectors the selectors of the selected fragments, with the paths their allowed settings hold
 * @returns the groups, where an absent files list means every code file
 */
export function selectorGroups(selectors: ResolvedSelector[]): SelectorGroup[] {
    const boundaries = distinctLists(
        selectors.flatMap((entry) => [entry.files ?? [], entry.except ?? []]).filter((paths) => paths.length > 0),
    );
    let groups: { files: string[][]; ignores: string[]; matched: string[][] }[] = [
        { files: [], ignores: [], matched: [] },
    ];
    for (const paths of boundaries)
        groups = groups.flatMap((group) => [
            {
                files:
                    group.files.length === 0
                        ? paths.map((path) => [path])
                        : group.files.flatMap((parts) => paths.map((path) => [...parts, path])),
                ignores: group.ignores,
                matched: [...group.matched, paths],
            },
            { ...group, ignores: [...group.ignores, ...paths] },
        ]);
    return groups.map((group) => ({
        ...(group.files.length === 0 ? {} : { files: group.files }),
        ...(group.ignores.length === 0 ? {} : { ignores: group.ignores }),
        selectors: selectors
            .filter(
                (entry) =>
                    (entry.files === undefined ||
                        group.matched.some((paths) => isDeepStrictEqual(paths, entry.files))) &&
                    (entry.except === undefined ||
                        !group.matched.some((paths) => isDeepStrictEqual(paths, entry.except))),
            )
            .map((entry) => ({ selector: entry.selector, message: entry.message })),
    }));
}
