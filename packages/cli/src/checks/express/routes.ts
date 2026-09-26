import { pathMatcher } from '#cli/repository/paths.ts';
import { scopeImports } from '#cli/checks/structure/imports.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';

/**
 * Reports routes without a test that imports their resolved module in the same scope.
 * @param input the engine input
 * @returns the findings
 */
export async function routesTested(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool('express');
    const routes = tool['route_files'] as string[];
    const tests = tool['test_files'] as string[];
    if (routes.length === 0 || tests.length === 0) return [];
    const isRoute = pathMatcher(routes);
    const isTest = pathMatcher(tests);
    const index = await scopeImports(input);
    const local = (path: string): string => (input.scope === '' ? path : path.slice(input.scope.length + 1));
    const untested = index.paths.filter(
        (path) =>
            isRoute(local(path)) &&
            !isTest(local(path)) &&
            [...(index.importers.get(path) ?? [])].every((importer) => !isTest(local(importer))),
    );
    return untested.map((path) => ({
        check: input.spec.name,
        file: path,
        line: 1,
        rule: 'untested-route',
        message: `No test in this scope imports ${local(path)}.`,
        fixable: false,
    }));
}
