import { extensionsTagged } from '#cli/repository/tags.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';

import type {
    EslintFiles,
    EslintModule,
    EslintFileInputs,
    EslintModuleInput,
    EslintFileSelector,
    EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

function selectorSource(selector: EslintFileSelector): string {
    if (typeof selector === 'string') return JSON.stringify(selector);
    if ('runtime' in selector) return `runtimeMatches(${String(selector.runtime.index)})`;
    return `policyMatches(${JSON.stringify(selector.scope)})`;
}

/**
 * Calculate the exact file sets shared by base blocks and every framework fragment.
 * @param input selected components, detected Node files, and authored test or script patterns
 * @returns code patterns and intersections that exclude non-code files
 */
export function eslintFilePatterns(input: EslintFileInputs): EslintFiles {
    const { components, tests, scripts, nodeFiles } = input;
    const source = eslintSourcePattern('javascript', 'typescript');
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
        typescriptSource: [typescript],
        typescript: [typescript, ...components],
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
 * Bind default block rendering to its level and optional project scope.
 * @param input the level, generated file selectors, authored options, and optional fragment scope
 * @returns rendered defaults and their identical ordered rule data
 */
export function eslintModule(input: EslintModuleInput): EslintModule {
    const { allRules, isAll, codeFiles, ruleOptions, scope } = input;
    const blocks: EslintSettingsBlock[] = [];
    return {
        blocks,
        block: (payload, runtime) => {
            const rules: Record<string, unknown> = Object.fromEntries(
                Object.entries(payload.rules ?? {}).map(([name, value]) => [
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
            const rendered = [block, ...configured];
            blocks.push(...rendered);
            return rendered
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
        for (const [name, setting] of Object.entries(entries ?? {})) {
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
    return paths
        .filter((path) => isInScope(path, scope))
        .map((path) => path.replaceAll(/[\\?*[\]{}()!]/gu, String.raw`\$&`));
}
