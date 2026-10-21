import { join, posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Substitutions } from '#cli/types/runs/command.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { type GeneratorOutput } from '#cli/types/configurations.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { readBytes, findCachedText } from '#cli/system/files/reads.ts';
import { GENERATOR_IGNORED_FOLDERS } from '#cli/config/checks/gspot.ts';
import type { GeneratorRun } from '#cli/types/checks/generator-outputs.ts';
import { expandCommand, replacePlaceholders, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';

function listMissingOutputs(
    session: Session,
    planned: PlannedCheck,
    outputs: GeneratorOutput[],
    commandText: string,
): Finding[] {
    return outputs
        .filter((target) => findCachedText(session.reads, target.path) === undefined)
        .map((entry) =>
            buildFinding(
                planned,
                { file: entry.path, line: 1 },
                'missing',
                `The file ${entry.path} does not exist; run ${commandText} and commit what it writes.`,
            ),
        );
}

// A pattern from a setting names one file, such as the Worker types file. A copy on disk that Git does not track hides it
// from the type checks and from this check, which compare tracked files.
function listUntrackedOutputs(session: Session, planned: PlannedCheck, named: string[], excluded: string[]): Finding[] {
    const scope = planned.scope.folder.path;
    const tracked = new Set(session.repository.index.map(({ path }) => path));
    return named.length === 0 || !session.repository.hasGit
        ? []
        : listMatchingPaths(join(session.root, scope), [...named, ...excluded])
              .map((path) => joinScope(scope, path))
              .filter((path) => !tracked.has(path))
              .toSorted((left, right) => left.localeCompare(right))
              .map((path) =>
                  buildFinding(
                      planned,
                      { file: path, line: 1 },
                      'untracked',
                      `${path} is not tracked. Commit it, so the other checks and this check can read it.`,
                  ),
              );
}

// Both snapshots use the same traversal and source containment boundary.
function readOutputContents({
    root,
    scope,
    patterns,
    targets,
    excluded,
}: {
    root: string;
    scope: string;
    patterns: string[];
    targets: GeneratorOutput[];
    excluded: string[];
}): Map<string, Buffer> {
    const cwd = join(root, scope);
    return new Map([
        ...listMatchingPaths(cwd, [...patterns, ...excluded]).map((path): [string, Buffer] => [
            joinScope(scope, path),
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
    session: Session,
    planned: PlannedCheck,
    values: Substitutions,
): { declared: GeneratorOutput[]; named: string[] } {
    const named: string[] = [];
    const declared = (planned.check.generator_outputs ?? []).flatMap((entry): GeneratorOutput[] => {
        const { kind, path: original } = entry;
        const isNamed = kind === 'pattern' && original.includes('{setting:');
        const replaced = replacePlaceholders(session, planned, original, values);
        const path = isNamed ? stripScopePrefix(replaced, planned.scope.folder.path) : replaced;
        if (path === '') return [];
        if (isNamed) named.push(path);
        return [{ kind, path }];
    });
    return { declared, named };
}

function listGeneratorSources(session: Session, planned: PlannedCheck): GeneratorRun | undefined {
    const values = buildCommandSubstitutions(session, planned, join(session.root, planned.scope.folder.path));
    const declaration = planned.check.command ?? [];
    const command = expandCommand(session, planned, declaration, values);
    if (command.length === 0) return undefined;

    const { declared, named } = listDeclaredOutputs(session, planned, values);
    if (declared.length === 0) return undefined;
    const targets = declared.filter((entry) => entry.kind !== 'pattern');
    const patterns = declared.filter((entry) => entry.kind === 'pattern').map((entry) => entry.path);
    const isMatched = buildPathMatcher(patterns);
    const selected = planned.files
        .map((file) => posix.relative(planned.scope.folder.path, file.path))
        .filter((path) => isMatched(path));

    const commandText = command.filter((part) => typeof part === 'string').join(' ');
    return { values, commandText, declaration, patterns, named, targets, selected };
}

/**
 * Runs the declared generator in a copy and reports missing or changed generator output.
 *
 * @param session the repository and its tools.
 * @param planned the generator check and its scope.
 * @returns one finding per missing or stale file.
 */
export async function checkGeneratorOutputs(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const sources = listGeneratorSources(session, planned);
    if (sources === undefined) return [];
    const { values, commandText, declaration, patterns, targets, selected } = sources;
    const excluded = [...GENERATOR_IGNORED_FOLDERS, DOT_GSPOT].map((name) => `!**/${name}/**`);
    const untracked = listUntrackedOutputs(session, planned, sources.named, excluded);
    if (untracked.length > 0) return untracked;
    if (targets.length + selected.length === 0) return [];
    const missing = listMissingOutputs(session, planned, targets, commandText);
    if (missing.length > 0) return missing;
    using folder = await createCheckCopy(
        session,
        planned,
        targets.map((entry) => entry.path),
    );
    const cwd = join(folder.path, planned.scope.folder.path);
    const outputFiles = { root: folder.path, scope: planned.scope.folder.path, patterns, targets, excluded };
    const before = readOutputContents(outputFiles);
    const commandArguments = expandCommand({ ...session, root: folder.path }, planned, declaration, {
        ...values,
        root: folder.path,
    });
    const commands = buildFileCommandLines(commandArguments, selected);
    let stdout = '';
    for (const commandLine of commands) {
        const result = await runCheckTool(session, planned, commandLine.commandArguments, { cwd });
        if (result.code !== 0) throw new Error(`The generator command failed: ${formatOutputTail(result)}`);
        stdout = result.stdout;
    }
    const after = readOutputContents(outputFiles);
    const stdoutPaths = new Set(targets.filter((entry) => entry.kind === 'stdout').map((entry) => entry.path));
    for (const path of stdoutPaths) after.set(path, Buffer.from(stdout.trim()));
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return (
                was === undefined ||
                now === undefined ||
                (stdoutPaths.has(path) ? was.toString('utf8').trim() !== now.toString('utf8') : !was.equals(now))
            );
        })
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'stale',
                `Running ${commandText} changes this generated file; commit what it writes.`,
            ),
        );
}
