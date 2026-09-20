// The Swift structure checks, each one analysis of the integrity engine.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { SwiftReader } from '#types/swift.ts';
import { functionsOf, swiftSources } from '#cli/structure/swift/sources.ts';
import { environmentReads, privateBeforePublic } from '#cli/structure/swift/order.ts';
import { callThroughs, duplicateFunctions, trivialFunctions } from '#cli/structure/swift/bodies.ts';

const DEFAULT_DUPLICATE_LINES = 4;

function names(input: EngineInput, key: string): Set<string> {
    const entries = (input.view.settings[key] as { names?: string[] }[] | undefined) ?? [];
    return new Set(entries.flatMap((entry) => entry.names ?? []));
}

function ownerPaths(input: EngineInput): string[] {
    const env = input.session.policyFiles.policy.architecture.roles['env'];
    if (env === undefined) return [];
    return Array.isArray(env) ? env : [env];
}

function analysis(read: SwiftReader): (input: EngineInput) => Promise<Finding[]> {
    return async (input) => {
        const sources = await swiftSources(input);
        const problems = read({ sources, functions: sources.flatMap((source) => functionsOf(source)) }, input);
        for (const source of sources) source.tree.delete();
        return problems.map((entry) => ({
            check: input.spec.name,
            file: entry.file,
            line: entry.line,
            rule: entry.rule,
            message: entry.text,
            fixable: false,
        }));
    };
}

/** The analyses by the name a manifest gives them. */
export const SWIFT_STRUCTURE: Record<string, (input: EngineInput) => Promise<Finding[]>> = {
    'swift-call-through': analysis(({ functions }) => callThroughs(functions)),
    'swift-trivial-function': analysis(({ sources, functions }, input) =>
        trivialFunctions(sources, functions, names(input, 'structure.swift.trivial_allowed')),
    ),
    'swift-duplicate-functions': analysis(({ functions }, input) =>
        duplicateFunctions(functions, input.view.limit('duplicate_min_lines', 'swift') ?? DEFAULT_DUPLICATE_LINES),
    ),
    'swift-private-before-public': analysis(({ sources }) => privateBeforePublic(sources)),
    'swift-env-access-owner': analysis(({ sources }, input) => environmentReads(sources, ownerPaths(input))),
};
