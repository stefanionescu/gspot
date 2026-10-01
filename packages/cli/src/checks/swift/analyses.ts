import { findingAt } from '#cli/checks/result.ts';
import { trivialFile } from '#cli/checks/structure/statements.ts';
import { DEFAULT_DUPLICATE_LINES } from '#cli/config/checks/swift.ts';
import { functionsOf, swiftSources } from '#cli/checks/swift/sources.ts';
import { DEFAULT_TRIVIAL_STATEMENTS } from '#cli/config/checks/structure.ts';
import { trivialFunctions, duplicateFunctions } from '#cli/checks/swift/bodies.ts';
import type { Engine, Finding, EngineInput, SwiftReader } from '#cli/types/checks.ts';
import { swiftBuild, swiftAnalyze, swiftPeriphery } from '#cli/checks/swift/build.ts';
import { importComments, environmentReads, privateBeforePublic } from '#cli/checks/swift/order.ts';

function ownerPaths(input: EngineInput): string[] {
    const env = input.policyFiles.policy.architecture.roles['env'];
    if (env === undefined) return [];
    return Array.isArray(env) ? env : [env];
}

function analysis(read: SwiftReader): (input: EngineInput) => Promise<Finding[]> {
    return async (input) => {
        const sources = await swiftSources(input);
        try {
            const problems = read({ sources, functions: sources.flatMap((source) => functionsOf(source)) }, input);
            return problems.map((entry) =>
                findingAt(input, { file: entry.file, line: entry.line }, entry.rule, entry.text),
            );
        } finally {
            for (const source of sources) source.tree.delete();
        }
    };
}

/** The analyses by the name a manifest gives them. */
const SWIFT_STRUCTURE: Record<string, Engine> = {
    'swift-trivial-function': analysis(({ functions, sources }, input) => {
        const threshold = input.view.limit('trivial_statements', 'swift') ?? DEFAULT_TRIVIAL_STATEMENTS;
        return [
            ...trivialFunctions(functions, threshold),
            ...sources
                .filter((source) => trivialFile(source.tree.rootNode, 'swift', threshold))
                .map((source) => ({
                    file: source.path,
                    line:
                        (source.tree.rootNode.namedChildren.find((node) => !node.type.includes('comment'))
                            ?.startPosition.row ?? 0) + 1,
                    rule: 'trivial-file',
                    text: 'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                })),
        ];
    }),
    'swift-duplicate-functions': analysis(({ functions }, input) =>
        duplicateFunctions(functions, input.view.limit('duplicate_min_lines', 'swift') ?? DEFAULT_DUPLICATE_LINES),
    ),
    'swift-private-before-public': analysis(({ sources }) => privateBeforePublic(sources)),
    'swift-env-access-owner': analysis(({ sources }, input) => environmentReads(sources, ownerPaths(input))),
    'swift-import-comments': analysis(({ sources }) => importComments(sources)),
};

/** Every swift analysis: the parsed-source ones above, then the ones that run the project's tools. */
export const SWIFT_ANALYSES: Record<string, Engine> = {
    ...SWIFT_STRUCTURE,
    'swift-build': swiftBuild,
    'swift-analyze': swiftAnalyze,
    'swift-periphery': swiftPeriphery,
};
