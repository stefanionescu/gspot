import { join, posix } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { type GeneratorOutput } from '#cli/types/configurations.ts';
import { formatOutputTail } from '#cli/checks/run/command/output.ts';
import type { Substitutions } from '#cli/types/checks/run/command.ts';
import { readBytes, readCachedText } from '#cli/system/files/reads.ts';
import { buildCommandSubstitutions } from '#cli/checks/run/command/check.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';
import { GENERATOR_SCAN_EXCLUSIONS } from '#cli/config/checks/stale-generator-outputs.ts';
import { expandCommand, replacePlaceholders, buildFileInvocations } from '#cli/checks/run/command/placeholders.ts';

function checkMissingOutputs(input: CheckInput, targets: GeneratorOutput[], commandText: string): Finding[] {
    const entry = targets.find((target) => readCachedText(input.reads, target.path) === undefined);
    if (entry === undefined) return [];
    return [
        buildFinding(
            input,
            { file: entry.path, line: 1 },
            'missing',
            `The file ${entry.path} does not exist; run ${commandText} and commit what it writes.`,
        ),
    ];
}

// Both snapshots use the same traversal and source containment boundary.
function readOutputContents(
    root: string,
    scope: string,
    patterns: string[],
    targets: GeneratorOutput[],
): Map<string, Buffer> {
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
          targets: GeneratorOutput[];
          selected: string[];
      }
    | undefined {
    const planned = input;
    const values = buildCommandSubstitutions(input, input, join(input.root, input.scope.scope.path));
    const declaration = input.check.command ?? [];
    const command = expandCommand(input, planned, declaration, values);
    if (command.length === 0) return undefined;

    const declared = (input.check.generator_outputs ?? []).flatMap((entry): GeneratorOutput[] => {
        const { kind, path: original } = entry;
        let path = replacePlaceholders(input, planned, original, values);
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
 * Runs the declared generator in a scratch copy and reports missing or changed generator output.
 * @param input the generator check and its scope.
 * @returns one finding per missing or stale file.
 */
export async function checkStaleGeneratorOutputs(input: CheckInput): Promise<Finding[]> {
    const inputs = buildGeneratorInputs(input);
    if (inputs === undefined) return [];
    const { planned, values, commandText, declaration, patterns, targets, selected } = inputs;
    const missing = checkMissingOutputs(input, targets, commandText);
    if (missing.length > 0) return missing;
    using folder = await copyIntoScratch(
        checkCopyInputs(
            input,
            targets.map((entry) => entry.path),
        ),
    );
    const cwd = join(folder.path, input.scope.scope.path);
    const before = readOutputContents(folder.path, input.scope.scope.path, patterns, targets);
    const commandArguments = expandCommand({ ...input, root: folder.path }, planned, declaration, {
        ...values,
        root: folder.path,
    });
    const commands = buildFileInvocations(commandArguments, selected);
    let stdout = '';
    for (const invocation of commands) {
        const result = await runCheckTool(input, invocation.commandArguments, { cwd });
        if (result.code !== 0) throw new Error(`The generator command failed: ${formatOutputTail(result)}`);
        stdout = result.stdout;
    }
    const after = readOutputContents(folder.path, input.scope.scope.path, patterns, targets);
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
            buildFinding(
                input,
                { file: path, line: 1 },
                'stale',
                `Running ${commandText} changes this generated file; commit what it writes.`,
            ),
        );
}
