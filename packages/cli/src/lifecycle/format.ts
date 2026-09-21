import type { CarriedFormatter, CarrySource } from '#types/lifecycle.ts';
import { evaluateConfiguration } from './configuration.ts';
import { compact } from '#cli/policy/normalize.ts';
import { formatRequest, formatResponse } from './format-request.ts';

async function resolvedFormatter(
    root: string,
    paths: string[],
    from: string,
    source?: CarrySource,
    ignorePath?: string,
): Promise<CarriedFormatter> {
    const { overrides, ...options } = source?.parsed ?? {};
    if (overrides !== undefined && !Array.isArray(overrides))
        throw new Error('Prettier overrides must contain a list.');
    const request = formatRequest.safeParse({
        root,
        paths,
        from,
        ...(ignorePath === undefined ? {} : { ignorePath }),
        ...(source === undefined ? {} : { source: options }),
    });
    if (!request.success)
        throw new Error(
            `Formatter configuration cannot be replaced without losing settings: ${request.error.issues.map((issue) => issue.message).join('; ')}`,
        );
    const parsed = formatResponse.parse(
        await evaluateConfiguration({ ...request.data, tool: 'prettier', operation: 'format' }),
    );
    return compact({
        format: compact(parsed.format),
        ignoredPaths: parsed.ignoredPaths,
        extra: parsed.extra === undefined ? undefined : compact(parsed.extra),
    });
}

/** Resolve supported formatting from a static root configuration without rewriting its selectors. */
export async function carryPrettier(
    root: string,
    source: CarrySource,
    path: string,
    paths: string[],
): Promise<CarriedFormatter> {
    return resolvedFormatter(root, paths, path, source);
}

/** Capture supported current-path formatting while keeping the original tool configuration active. */
export async function carryResolvedFormat(
    root: string,
    paths: string[],
    from: string,
    ignorePath?: string,
): Promise<CarriedFormatter> {
    return resolvedFormatter(root, paths, from, undefined, ignorePath);
}
