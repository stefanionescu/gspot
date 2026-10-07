import { compact } from '#cli/platform/objects.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { isInScope, pathExpressions } from '#cli/repository/selectors.ts';
import { ESLINT_BROWSER_CONFIGURATIONS } from '#cli/config/generation/eslint.ts';
import type { EslintSettings, EslintRuntimeBlock } from '#cli/types/generation/eslint.ts';

function frameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes('react-native')) return 'react-native';
    if (configurations.includes('nextjs')) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

/**
 * Resolve one runtime per file from scoped framework defaults and authored runtime declarations.
 * More specific scopes and later authored selectors take precedence. Build scripts retain Node.js
 * unless an authored runtime explicitly selects them.
 * @param scopes the resolved configurations and settings of every project scope
 * @returns runtime declarations in increasing precedence order
 */
export function runtimeBlocks(scopes: ScopeSelection[]): EslintRuntimeBlock[] {
    const blocks: EslintRuntimeBlock[] = [];
    for (const selection of scopes.toSorted((left, right) => left.scope.path.length - right.scope.path.length)) {
        const scope = selection.scope.path;
        const children = scopes
            .map((entry) => entry.scope.path)
            .filter((path) => path !== scope && isInScope(path, scope))
            .map((path) => {
                const local = path.slice(scope === '' ? 0 : scope.length + 1);
                const literal = local.replaceAll(/[?*[\]{}()!]/gu, String.raw`\$&`);
                return `!${literal}/**`;
            });
        const tool = selection.view.options('tools.eslint') as EslintSettings;
        const version = compact({
            nodeVersion: selection.view.settings['tools.eslint.node_version'] as string | undefined,
        });
        blocks.push(
            { scope, ...version, runtime: 'node', ...pathExpressions(['**/*', ...children]) },
            { scope, ...version, runtime: 'commonjs', ...pathExpressions(['**/*.{cjs,cts}', ...children]) },
        );
        const runtime = frameworkRuntime(selection.view.configurations);
        if (runtime !== undefined) {
            const scripts = tool.script_files ?? [];
            blocks.push({
                scope,
                ...version,
                runtime,
                ...pathExpressions(['**/*', '!**/*.{cjs,cts}', ...scripts.map((path) => `!${path}`), ...children]),
            });
        }
        blocks.push(
            ...(tool.runtimes === undefined ? [] : Object.entries(tool.runtimes)).map(([glob, runtime]) => ({
                scope,
                ...version,
                runtime,
                ...pathExpressions([glob, ...children]),
            })),
        );
    }
    return blocks;
}
