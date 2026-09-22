// Each governed route has an importing test in its own scope.
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { scopeImports } from '#cli/structure/imports.ts';

/**
 * Reports routes without a test that imports their resolved module in the same scope.
 * @param input the engine input
 * @returns the findings
 */
export function routesTested(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool('express');
    const routes = tool['route_glob'] as string[];
    const tests = tool['test_glob'] as string[];
    if (routes.length === 0 || tests.length === 0) return Promise.resolve([]);
    const isRoute = pathMatcher(routes);
    const isTest = pathMatcher(tests);
    const index = scopeImports(input);
    const local = (path: string): string => (input.scope === '' ? path : path.slice(input.scope.length + 1));
    const untested = index.paths.filter(
        (path) =>
            isRoute(local(path)) &&
            !isTest(local(path)) &&
            [...(index.importers.get(path) ?? [])].every((importer) => !isTest(local(importer))),
    );
    return Promise.resolve(
        untested.map((path) => ({
            check: input.spec.name,
            file: path,
            line: 1,
            rule: 'untested-route',
            message: `No test in this scope imports ${local(path)}.`,
            fixable: false,
        })),
    );
}
