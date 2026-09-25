import type { EngineInput } from '#cli/checks/input.ts';
import type { Finding } from '#cli/checks/result.ts';
import { scopeImports } from '#cli/checks/structure/imports.ts';
import type { ArchitectureElement } from '#cli/policy/normalize.ts';
import { pathMatcher } from '#cli/repository/paths.ts';

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

/**
 * One finding for each value import that reaches into the server paths from outside them.
 * @param input the engine input
 * @returns the findings
 */
export async function trpcBoundaries(input: EngineInput): Promise<Finding[]> {
    const elements = (input.view.settings['architecture.elements'] ?? []) as ArchitectureElement[];
    const server = elements.find((element) => element.name === 'server');
    const isServer = pathMatcher(server?.paths ?? (input.view.tool('trpc')['server_files'] as string[]));
    const local = (path: string): string => (input.scope === '' ? path : path.slice(input.scope.length + 1));
    const index = await scopeImports(input);
    return index.edges
        .filter((edge) => !isServer(local(edge.from)) && isServer(local(edge.to)))
        .map((edge) => ({
            ...finding(
                input,
                edge.from,
                edge.line,
                'server-import',
                `${edge.source} is server code. Import its types with import type.`,
            ),
            column: edge.column,
        }));
}
