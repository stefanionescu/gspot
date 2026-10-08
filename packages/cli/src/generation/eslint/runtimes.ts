import { posix } from 'node:path';
import { compact } from '#cli/platform/contracts.ts';
import { rolePaths } from '#cli/policy/settings/contracts.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { isInScope, pathExpressions } from '#cli/repository/paths/public.ts';
import type { EslintContext, EslintRuntimeBlock } from '#cli/types/generation/eslint.ts';
import { MISE_SCRIPT_PATH, ESLINT_BROWSER_CONFIGURATIONS } from '#cli/config/generation/eslint.ts';

function frameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes('react-native')) return 'react-native';
    if (configurations.includes('nextjs')) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

/**
 * Select script paths, including Mise task files only for repositories that use that runner.
 * @param context the policy and resolved project selection
 * @param context.policy the selected repository runner
 * @param context.selection the resolved project scope
 * @returns repository-relative paths whose files use script rules
 */
export function scriptPaths({ policy, selection }: Pick<EslintContext, 'policy' | 'selection'>): string[] {
    const scripts = rolePaths(selection.view.roles, 'scripts');
    return policy.runner === 'mise' ? [...scripts, posix.join(selection.scope.path, MISE_SCRIPT_PATH)] : scripts;
}

/**
 * Resolve one runtime per file from scoped framework defaults and authored runtime declarations.
 * More specific scopes and later authored selectors take precedence. Build scripts retain Node.js
 * unless an authored runtime explicitly selects them.
 * @param policy the selected repository runner
 * @param scopes the resolved configurations and settings of every project scope
 * @returns runtime declarations in increasing precedence order
 */
export function runtimeBlocks(policy: Policy, scopes: ScopeSelection[]): EslintRuntimeBlock[] {
    const blocks: EslintRuntimeBlock[] = [];
    for (const selection of scopes.toSorted((left, right) => left.scope.path.length - right.scope.path.length)) {
        const scope = selection.scope.path;
        const children = scopes
            .map((entry) => entry.scope.path)
            .filter((path) => path !== scope && isInScope(path, scope))
            .map((path) => {
                const literal = path.replaceAll(/[?*[\]{}()!]/gu, String.raw`\$&`);
                return `!${literal}/**`;
            });
        const prefix = scope === '' ? '' : `${scope}/`;
        const tool = selection.view.values['tools.eslint'];
        const version = compact({
            nodeVersion: tool?.node_version,
        });
        blocks.push(
            { scope, ...version, runtime: 'node', ...pathExpressions([`${prefix}**/*`, ...children]) },
            { scope, ...version, runtime: 'commonjs', ...pathExpressions([`${prefix}**/*.{cjs,cts}`, ...children]) },
        );
        const runtime = frameworkRuntime(selection.view.configurations);
        if (runtime !== undefined) {
            const scripts = scriptPaths({ policy, selection });
            blocks.push({
                scope,
                ...version,
                runtime,
                ...pathExpressions([
                    `${prefix}**/*`,
                    `!${prefix}**/*.{cjs,cts}`,
                    ...scripts.map((path) => `!${path}`),
                    ...children,
                ]),
            });
        }
        blocks.push(
            ...(tool?.runtimes === undefined ? [] : Object.entries(tool.runtimes)).map(([glob, runtime]) => ({
                scope,
                ...version,
                runtime,
                ...pathExpressions([glob, ...children]),
            })),
        );
    }
    return blocks;
}
