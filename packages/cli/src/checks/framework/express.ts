import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { scopeImports } from '#cli/checks/language/javascript/imports.ts';

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
    const untested = index.paths.filter(
        (path) =>
            isRoute(input.scope === '' ? path : path.slice(input.scope.length + 1)) &&
            !isTest(input.scope === '' ? path : path.slice(input.scope.length + 1)) &&
            [...(index.importers.get(path) ?? [])].every(
                (importer) => !isTest(input.scope === '' ? importer : importer.slice(input.scope.length + 1)),
            ),
    );
    return untested.map((path) =>
        findingAt(
            input,
            { file: path, line: 1 },
            'untested-route',
            `No test in this scope imports ${input.scope === '' ? path : path.slice(input.scope.length + 1)}.`,
        ),
    );
}
