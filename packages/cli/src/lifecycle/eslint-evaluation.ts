import type { z } from 'zod';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { convertPathToPattern } from 'globby';
import { eslintRequest, eslintResponse } from './eslint-request.ts';

/** Resolve every governed path through the repository's own ESLint implementation. */
export async function evaluateEslint(request: z.infer<typeof eslintRequest>): Promise<z.infer<typeof eslintResponse>> {
    const result: z.infer<typeof eslintResponse> = { overrides: [], ignores: [], notes: [] };
    let implementation: string;
    try {
        implementation = createRequire(join(request.root, 'package.json')).resolve('eslint');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw error;
        result.notes.push(
            'repository ESLint is not installed; its configuration is retained without carrying settings',
        );
        return result;
    }
    const module = (await import(pathToFileURL(implementation).href)) as typeof import('eslint');
    const Constructor = await module.loadESLint({ useFlatConfig: request.flat });
    const eslint = new Constructor({ cwd: request.root });
    const groups = new Map<string, { paths: string[]; rules: Record<string, unknown> }>();
    const ignored = new Map<string, string[]>();
    for (const path of request.paths) {
        const isIgnored = await eslint.isPathIgnored(join(request.root, path));
        const config = isIgnored ? undefined : await eslint.calculateConfigForFile(join(request.root, path));
        const selector = convertPathToPattern(path);
        if (config === undefined) {
            if (/\.[cm]?[jt]sx?$/u.test(path)) result.ignores.push({ paths: [selector] });
            continue;
        }
        if (config.processor !== undefined) {
            result.notes.push(
                `${path}: processor behavior remains in the original configuration; rules were not carried`,
            );
            continue;
        }
        const rules: Record<string, unknown> = {};
        for (const [rule, value] of Object.entries(config.rules ?? {})) {
            if (rule.includes('/')) continue;
            const severity = Array.isArray(value) ? value[0] : value;
            if (severity === 0 || severity === 'off') {
                const paths = ignored.get(rule) ?? [];
                paths.push(selector);
                ignored.set(rule, paths);
            } else rules[rule] = value;
        }
        if (Object.keys(rules).length === 0) continue;
        const key = JSON.stringify(Object.entries(rules).toSorted(([a], [b]) => a.localeCompare(b)));
        const group = groups.get(key) ?? { paths: [], rules };
        group.paths.push(selector);
        groups.set(key, group);
    }
    result.overrides = eslintResponse.shape.overrides.parse([...groups.values()]);
    result.ignores.push(...[...ignored].map(([rule, paths]) => ({ rule, paths })));
    result.notes.push(
        'captured core rules describe current files; plugins, language options and future selectors remain in the original configuration',
    );
    return result;
}
