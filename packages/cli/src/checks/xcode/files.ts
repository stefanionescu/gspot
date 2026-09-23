import { readSource } from '#cli/repository/tracked.ts';
// What the xcode checks share: the tracked files by ending, their text, and the finding shape.
import { scopeOf } from '#cli/repository/scopes.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';

/**
 * The tracked source files whose path ends one of the given ways.
 * @param input the engine input
 * @param endings the path endings
 * @returns the paths
 */
export function trackedEnding(input: EngineInput, endings: string[]): string[] {
    return input.files
        .filter(
            (file) =>
                file.nature === 'source' &&
                scopeOf(file.path, input.scopeEntries).path === input.scope &&
                endings.some((ending) => file.path.endsWith(ending)),
        )
        .map((file) => file.path);
}

/**
 * The text of a tracked file.
 * @param input the engine input
 * @param path the repository-relative path
 * @returns the text
 */
export function textOf(input: EngineInput, path: string): string {
    return readSource(input.root, path).toString('utf8');
}

/**
 * One finding of an xcode check.
 * @param input the engine input
 * @param at the file and the line
 * @param at.file the file
 * @param at.line the line
 * @param rule the rule
 * @param text the message
 * @returns the finding
 */
export function xcodeFinding(
    input: EngineInput,
    at: { file: string; line: number },
    rule: string,
    text: string,
): Finding {
    return { check: input.spec.name, file: at.file, line: at.line, rule, message: text, fixable: false };
}
