import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { type GeneratedPath } from '#cli/types/configurations.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import type { Substitutions } from '#cli/types/execution/command.ts';
import { commandSubstitutions } from '#cli/execution/command/check.ts';
import { readBytes, readCachedText } from '#cli/system/files/reads.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { GENERATOR_SCAN_EXCLUSIONS } from '#cli/config/checks/stale-generated-files.ts';
import { substitute, perFileCommands, substituteValue } from '#cli/execution/command/placeholders.ts';

function missingOutputs(input: CheckInput, targets: GeneratedPath[], commandText: string): Finding[] {
    const entry = targets.find((target) => readCachedText(input.reads, target.path) === undefined);
    if (entry === undefined) return [];
    return [
        findingAt(
            input,
            { file: entry.path, line: 1 },
            'missing',
            `The file ${entry.path} does not exist; run ${commandText} and commit what it writes.`,
        ),
    ];
}

// Both snapshots use the same traversal and source containment boundary.
function copiedFiles(root: string, scope: string, patterns: string[], targets: GeneratedPath[]): Map<string, Buffer> {
    const cwd = join(root, scope);
    const excluded = [...GENERATOR_SCAN_EXCLUSIONS, DOT_GSPOT].map((name) => `!**/${name}/**`);
    return new Map([
        ...listMatchingPaths(cwd, [...patterns, ...excluded]).map((path): [string, Buffer] => [
            posix.join(scope, path),
            readBytes(cwd, path),
        ]),
        ...targets.map((entry): [string, Buffer] => [entry.path, readBytes(root, entry.path)]),
    ]);
}

function buildGeneratorInputs(input: CheckInput):
    | {
          planned: CheckInput;
          values: Substitutions;
          commandText: string;
          declaration: string[];
          patterns: string[];
          targets: GeneratedPath[];
          selected: string[];
      }
    | undefined {
    const planned = input;
    const values = commandSubstitutions(input, input, join(input.root, input.scope.scope.path));
    const declaration = input.check.command ?? [];
    const command = substitute(input, planned, declaration, values);
    if (command.length === 0) return undefined;

    const declared = (input.check.generator_outputs ?? []).flatMap((entry): GeneratedPath[] => {
        const { kind, path: original } = entry;
        let path = substituteValue(input, planned, original, values);
        if (kind === 'pattern' && original.includes('{setting:') && input.scope.scope.path !== '') {
            const prefix = path.startsWith('**/') ? '**/' : '';
            const scopePath = path.slice(prefix.length);
            if (scopePath.startsWith(`${input.scope.scope.path}/`))
                path = `${prefix}${scopePath.slice(input.scope.scope.path.length + 1)}`;
        }
        return path === '' ? [] : [{ kind, path }];
    });

    if (declared.length === 0) return undefined;
    const targets = declared.filter((entry) => entry.kind !== 'pattern');
    const patterns = declared.filter((entry) => entry.kind === 'pattern').map((entry) => entry.path);
    const isMatched = buildPathMatcher(patterns);
    const selected = input.files
        .map((file) => posix.relative(input.scope.scope.path, file.path))
        .filter((path) => isMatched(path));

    if (targets.length === 0 && selected.length === 0) return undefined;
    const commandText = command.filter((part) => typeof part === 'string').join(' ');
    return { planned, values, commandText, declaration, patterns, targets, selected };
}

/**
 * Run the declared generator in a private copy and compare its outputs.
 * @param input the selected generator and project scope.
 * @returns located missing or stale generated paths.
 */
export async function checkStaleGeneratorOutputs(input: CheckInput): Promise<Finding[]> {
    const inputs = buildGeneratorInputs(input);
    if (inputs === undefined) return [];
    const { planned, values, commandText, declaration, patterns, targets, selected } = inputs;
    const missing = missingOutputs(input, targets, commandText);
    if (missing.length > 0) return missing;
    using folder = await copyIntoScratch(
        checkCopyInputs(
            input,
            targets.map((entry) => entry.path),
        ),
    );
    const cwd = join(folder.path, input.scope.scope.path);
    const before = copiedFiles(folder.path, input.scope.scope.path, patterns, targets);
    const argv = substitute({ ...input, root: folder.path }, planned, declaration, {
        ...values,
        root: folder.path,
    });
    const commands = perFileCommands(argv, selected);
    let stdout = '';
    for (const invocation of commands) {
        const result = await runCheckTool(input, invocation.argv, { cwd });
        if (result.code !== 0)
            throw new Error(
                `The generator command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
            );
        stdout = result.stdout;
    }
    const after = copiedFiles(folder.path, input.scope.scope.path, patterns, targets);
    const trimmed = new Set(targets.filter((entry) => entry.kind === 'stdout').map((entry) => entry.path));
    for (const path of trimmed) after.set(path, Buffer.from(stdout.trim()));
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return (
                was === undefined ||
                now === undefined ||
                (trimmed.has(path) ? was.toString('utf8').trim() !== now.toString('utf8') : !was.equals(now))
            );
        })
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'stale',
                `Running ${commandText} changes this generated file; commit what it writes.`,
            ),
        );
}
