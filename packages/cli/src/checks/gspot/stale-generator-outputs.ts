import { join, posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Substitutions } from '#cli/types/runs/command.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { type GeneratorOutput } from '#cli/types/configurations.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { readBytes, readCachedText } from '#cli/system/files/reads.ts';
import { GENERATOR_SCAN_EXCLUSIONS } from '#cli/config/checks/gspot.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/runs/scratch-copy/scratch.ts';
import { expandCommand, replacePlaceholders, buildFileInvocations } from '#cli/runs/command/placeholders.ts';

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

// A pattern from a setting names one file, such as the Worker types file. A copy on disk that Git does not track hides it
// from the type checks and from this check, which compare tracked files.
function checkUntrackedOutputs(input: CheckInput, named: string[]): Finding[] {
    const scope = input.selection.scope.path;
    const tracked = new Set(input.index.map(({ path }) => path));
    const excluded = [...GENERATOR_SCAN_EXCLUSIONS, DOT_GSPOT].map((name) => `!**/${name}/**`);
    return named.length === 0 || !input.hasGit
        ? []
        : listMatchingPaths(join(input.root, scope), [...named, ...excluded])
              .map((path) => posix.join(scope, path))
              .filter((path) => !tracked.has(path))
              .toSorted((left, right) => left.localeCompare(right))
              .map((path) =>
                  buildFinding(
                      input,
                      { file: path, line: 1 },
                      'untracked',
                      `${path} is not tracked. Commit it, so the other checks and this check can read it.`,
                  ),
              );
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

// A pattern from a setting holds a repository path; the scan of a scope reads it from the scope folder.
function stripScopePrefix(path: string, scope: string): string {
    const prefix = path.startsWith('**/') ? '**/' : '';
    const scopePath = path.slice(prefix.length);
    return scope !== '' && scopePath.startsWith(`${scope}/`) ? `${prefix}${scopePath.slice(scope.length + 1)}` : path;
}

function listDeclaredOutputs(
    input: CheckInput,
    values: Substitutions,
): { declared: GeneratorOutput[]; named: string[] } {
    const named: string[] = [];
    const declared = (input.check.generator_outputs ?? []).flatMap((entry): GeneratorOutput[] => {
        const { kind, path: original } = entry;
        const isNamed = kind === 'pattern' && original.includes('{setting:');
        const replaced = replacePlaceholders(input, input, original, values);
        const path = isNamed ? stripScopePrefix(replaced, input.selection.scope.path) : replaced;
        if (path === '') return [];
        if (isNamed) named.push(path);
        return [{ kind, path }];
    });
    return { declared, named };
}

function buildGeneratorInputs(input: CheckInput):
    | {
          values: Substitutions;
          commandText: string;
          declaration: string[];
          patterns: string[];
          named: string[];
          targets: GeneratorOutput[];
          selected: string[];
      }
    | undefined {
    const values = buildCommandSubstitutions(input, input, join(input.root, input.selection.scope.path));
    const declaration = input.check.command ?? [];
    const command = expandCommand(input, input, declaration, values);
    if (command.length === 0) return undefined;

    const { declared, named } = listDeclaredOutputs(input, values);
    if (declared.length === 0) return undefined;
    const targets = declared.filter((entry) => entry.kind !== 'pattern');
    const patterns = declared.filter((entry) => entry.kind === 'pattern').map((entry) => entry.path);
    const isMatched = buildPathMatcher(patterns);
    const selected = input.files
        .map((file) => posix.relative(input.selection.scope.path, file.path))
        .filter((path) => isMatched(path));

    const commandText = command.filter((part) => typeof part === 'string').join(' ');
    return { values, commandText, declaration, patterns, named, targets, selected };
}

function checkBeforeRun(
    input: CheckInput,
    inputs: Pick<
        NonNullable<ReturnType<typeof buildGeneratorInputs>>,
        'named' | 'targets' | 'selected' | 'commandText'
    >,
): Finding[] | undefined {
    const untracked = checkUntrackedOutputs(input, inputs.named);
    if (untracked.length > 0) return untracked;
    if (inputs.targets.length === 0 && inputs.selected.length === 0) return [];
    const missing = checkMissingOutputs(input, inputs.targets, inputs.commandText);
    return missing.length > 0 ? missing : undefined;
}

/**
 * Runs the declared generator in a scratch copy and reports missing or changed generator output.
 * @param input the generator check and its scope.
 * @returns one finding per missing or stale file.
 */
export async function checkStaleGeneratorOutputs(input: CheckInput): Promise<Finding[]> {
    const inputs = buildGeneratorInputs(input);
    if (inputs === undefined) return [];
    const { values, commandText, declaration, patterns, targets, selected } = inputs;
    const early = checkBeforeRun(input, inputs);
    if (early !== undefined) return early;
    using folder = await copyIntoScratch(
        checkCopyInputs(
            input,
            targets.map((entry) => entry.path),
        ),
    );
    const cwd = join(folder.path, input.selection.scope.path);
    const before = readOutputContents(folder.path, input.selection.scope.path, patterns, targets);
    const commandArguments = expandCommand({ ...input, root: folder.path }, input, declaration, {
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
    const after = readOutputContents(folder.path, input.selection.scope.path, patterns, targets);
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
