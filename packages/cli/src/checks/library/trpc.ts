import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { ArchitectureElement } from '#cli/types/policy/settings.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { getScopeImports } from '#cli/checks/language/javascript/imports.ts';

/**
 * One finding for each value import that reaches into the server paths from outside them.
 * @param input the engine input
 * @returns the findings
 */
export async function trpcBoundaries(input: EngineInput): Promise<Finding[]> {
    const elements = (input.view.settings['architecture.modules'] ?? []) as ArchitectureElement[];
    const server = elements.find((element) => element.name === 'server');
    const isServer = pathMatcher(server?.paths ?? (input.view.options('trpc')['server_files'] as string[]));
    const index = await getScopeImports(input);
    return index.edges
        .filter(
            (edge) =>
                !isServer(input.scope === '' ? edge.from : edge.from.slice(input.scope.length + 1)) &&
                isServer(input.scope === '' ? edge.to : edge.to.slice(input.scope.length + 1)),
        )
        .map((edge) =>
            findingAt(
                input,
                { file: edge.from, line: edge.line, column: edge.column },
                'server-import',
                `${edge.source} is server code. Import its types with import type.`,
            ),
        );
}
