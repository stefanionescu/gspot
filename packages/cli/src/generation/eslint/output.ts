import type { EslintAllRules } from '#cli/types/parsers/eslint.ts';
import { ESLINT_CODE_FILES, ESLINT_JAVASCRIPT_FILES, ESLINT_TYPESCRIPT_FILES } from '#cli/config/eslint.ts';

import type {
    EslintFiles,
    EslintModule,
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
 * @param components component patterns supplied by selected fragments
 * @param tests authored test patterns
 * @param scripts authored script patterns
 * @returns code patterns and intersections that exclude non-code files
 */
export function eslintFilePatterns(components: string[], tests: string[], scripts: string[]): EslintFiles {
    const code = [ESLINT_CODE_FILES, ...components];
    return {
        code,
        typescriptSource: [ESLINT_TYPESCRIPT_FILES],
        typescript: [ESLINT_TYPESCRIPT_FILES, ...components],
        javascript: [ESLINT_JAVASCRIPT_FILES],
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
 * @param allRules the house style rule IDs generated from the actual metadata.
 * @param isAll whether house style rules apply.
 * @param codeFiles the complete code patterns including framework components.
 * @param scope the fragment's owning scope, absent for root blocks.
 *
 * @param scope.path the owning folder, relative to the repository root.
 * @param scope.excluded the nested project patterns excluded from this fragment.
 * @returns rendered defaults and their identical ordered rule data.
 */
export function eslintModule(
    allRules: EslintAllRules,
    isAll: boolean,
    codeFiles: string[],
    scope?: { path: string; excluded: string[] },
): EslintModule {
    const blocks: EslintSettingsBlock[] = [];
    return {
        blocks,
        block: (payload, runtime) => {
            const rules =
                payload.rules === undefined
                    ? {}
                    : {
                          rules: Object.fromEntries(
                              Object.entries(payload.rules).map(([name, value]) => [
                                  name,
                                  !isAll && allRules.has(name) ? 'off' : value,
                              ]),
                          ),
                      };
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
            const block = { ...payload, ...rules, ...nested };
            blocks.push(block);
            const rendered = serializeEslintBlock(block, runtime);
            return scope === undefined ? rendered : `stripRuntimeGlobals(${rendered})`;
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
