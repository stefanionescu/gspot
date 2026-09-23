import { trivialFile } from '#cli/structure/statements.ts';
// The Swift structure checks, each one analysis of the integrity engine.
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import type { SwiftReader } from '#cli/structure/swift/types.ts';
import { functionsOf, swiftSources } from '#cli/structure/swift/sources.ts';
import { environmentReads, privateBeforePublic } from '#cli/structure/swift/order.ts';
import { duplicateFunctions, trivialFunctions } from '#cli/structure/swift/bodies.ts';

const DEFAULT_DUPLICATE_LINES = 4;

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
            return problems.map((entry) => ({
                check: input.spec.name,
                file: entry.file,
                line: entry.line,
                rule: entry.rule,
                message: entry.text,
                fixable: false,
            }));
        } finally {
            for (const source of sources) source.tree.delete();
        }
    };
}

/** The analyses by the name a manifest gives them. */
export const SWIFT_STRUCTURE: Record<string, (input: EngineInput) => Promise<Finding[]>> = {
    'swift-trivial-function': analysis(({ functions, sources }, input) => {
        const threshold = input.view.limit('trivial_statements', 'swift') ?? 2;
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
};
