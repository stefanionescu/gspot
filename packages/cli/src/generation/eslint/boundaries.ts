import type { ScopeView } from '#cli/types/policy/settings.ts';
import { isInScope, nestedScopes } from '#cli/repository/paths/public.ts';
import { eslintNodePatterns, eslintSourcePattern } from '#cli/generation/eslint/public.ts';

import type {
    EslintBlock,
    EslintContext,
    EslintBoundaryPolicy,
    EslintBoundaryContext,
} from '#cli/types/generation/eslint.ts';
import {
    ROLE_ORDER,
    ROLE_IMPORT_POLICIES,
    TRPC_DEPENDENCY_NODES,
    TRPC_SERVER_VALUE_POLICY,
    TRPC_DEPENDENCY_SELECTORS,
    TRPC_UNKNOWN_IMPORT_POLICIES,
} from '#cli/config/generation/eslint.ts';

// Native file patterns retain role precedence and the authored origin of module references.
function roleDescriptors(view: ScopeView): EslintBoundaryContext['roles'] {
    const modules = new Map((view.values.architecture?.modules ?? []).map(({ name, paths }) => [name, paths]));
    return ROLE_ORDER.map((role) => ({
        category: `role:${role}`,
        pattern: [view.roles[role] ?? []]
            .flat()
            .flatMap(
                (entry) =>
                    modules.get(entry) ?? [
                        role === 'test_harness' ? `${entry.replace(/\/(?:\*\*)?$/u, '')}/**` : entry,
                    ],
            ),
        stopMatching: true,
    })).filter(({ pattern }) => pattern.length > 0);
}

// Module edges keep their test exemptions; the role directions and server-value restriction apply last.
function dependencyPolicies({ modules, roles, tests, trpc }: EslintBoundaryContext): EslintBoundaryPolicy[] {
    const policies: EslintBoundaryPolicy[] = modules.map((module) => ({
        from: { file: { categories: `module:${module.name}` } },
        allow: { to: { file: { categories: { anyOf: (module.may_import ?? []).map((name) => `module:${name}`) } } } },
    }));
    if (trpc || roles.length > 0)
        policies.push(
            ...TRPC_UNKNOWN_IMPORT_POLICIES,
            { from: { file: { path: tests } }, allow: { to: { file: { path: '**/*' } } } },
            { allow: { to: { file: { path: tests } } } },
        );
    if (roles.length > 0) {
        const outsideModules = { categories: { noneOf: modules.map(({ name }) => `module:${name}`) } };
        policies.push(
            { from: { file: outsideModules }, allow: { to: { file: { path: '**/*' } } } },
            { allow: { to: { file: outsideModules } } },
            ...ROLE_IMPORT_POLICIES,
        );
    }
    if (trpc) policies.push(TRPC_SERVER_VALUE_POLICY);
    return policies;
}

// File categories distinguish authored modules from roles; native elements cover unknown dependency endpoints.
function boundarySettings({
    modules,
    roles,
    prefix,
    tests,
    trpc,
}: EslintBoundaryContext): NonNullable<EslintBlock['settings']> {
    const files = modules.map((module) => ({ category: `module:${module.name}`, pattern: module.paths }));
    files.push(...roles);
    if (roles.length > 0) files.push({ category: 'role:other', pattern: [`${prefix}**/*`] });
    const settings: NonNullable<EslintBlock['settings']> = {
        'boundaries/files': files,
        'boundaries/ignore': trpc || roles.length > 0 ? [] : tests,
    };
    if (trpc || roles.length > 0)
        Object.assign(settings, {
            'boundaries/elements': [{ type: 'other', pattern: `${prefix}**`, partialMatch: false }],
            'boundaries/dependency-nodes': TRPC_DEPENDENCY_NODES,
            'boundaries/additional-dependency-nodes': TRPC_DEPENDENCY_SELECTORS,
        });
    return settings;
}

/**
 * Compose native module and role policies within each selected scope.
 * @param context resolved scopes, level, and authored Node script paths.
 * @param context.policy the resolved policy level.
 * @param context.scopes selected scopes and normalized role paths.
 * @param context.nodeFiles authored Node.js entry paths.
 * @returns scoped boundary settings and rules with child projects excluded.
 */
export function boundaryBlocks(context: EslintContext): EslintBlock[] {
    const { policy, scopes, nodeFiles } = context;
    return scopes
        .map(({ scope, view, selected }) => {
            const modules = view.values.architecture?.modules ?? [];
            const roles = policy.level === 'all' ? roleDescriptors(view) : [];
            return {
                path: scope.path,
                modules,
                roles,
                prefix: scope.path === '' ? '' : `${scope.path}/`,
                tests: view.test_files,
                trpc:
                    selected.some(({ configuration }) => configuration.name === 'trpc') &&
                    modules.some(({ name }) => name === 'server'),
            };
        })
        .filter(({ modules, roles }) => modules.length + roles.length > 0)
        .map((input) => ({
            files: [
                `${input.prefix}${eslintSourcePattern('javascript', 'typescript')}`,
                ...eslintNodePatterns(
                    nodeFiles.filter((file) => isInScope(file, input.path)),
                    '',
                ),
            ],
            ignores: nestedScopes(
                scopes.map(({ scope }) => scope.path),
                input.path,
            ).map((scope) => `${scope}/**`),
            settings: boundarySettings(input),
            rules: {
                'boundaries/dependencies': [
                    'error',
                    {
                        default: input.modules.length > 0 ? 'disallow' : 'allow',
                        policies: dependencyPolicies(input),
                        checkInternals: input.trpc || input.roles.length > 0,
                    },
                ],
            },
        }));
}
