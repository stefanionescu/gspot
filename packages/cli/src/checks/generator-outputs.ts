import { join, posix } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Substitutions } from '#cli/types/runs/command.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { type GeneratorOutput } from '#cli/types/configurations.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { readBytes, findCachedText } from '#cli/system/files/reads.ts';
import type { GeneratorRun } from '#cli/types/checks/generator-outputs.ts';
import { GENERATOR_IGNORED_FOLDERS } from '#cli/config/checks/generator-outputs.ts';
import { expandCommand, replacePlaceholders, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';

function listMissingOutputs(
    session: Session,
    planned: PlannedCheck,
    outputs: GeneratorOutput[],
    commandText: string,
): Finding[] {
    return outputs
        .filter((target) => findCachedText(session.reads, target.path) === undefined)
        .map((output) =>
            buildFinding(
                planned,
                { file: output.path, line: 1 },
                'missing',
                `The file ${output.path} does not exist; run ${commandText} and commit what it writes.`,
            ),
        );
}

function listUntrackedOutputs(session: Session, planned: PlannedCheck, named: string[], excluded: string[]): Finding[] {
    const scope = planned.scope.folder.path;
    const tracked = new Set(session.repository.index.map(({ path }) => path));
    return named.length === 0 || !session.repository.hasGit
        ? []
        : listMatchingPaths(join(session.root, scope), [...named, ...excluded])
              .map((path) => joinScope(scope, path))
              .filter((path) => !tracked.has(path))
              .toSorted((left, right) => compareText(left, right))
              .map((path) =>
                  buildFinding(
                      planned,
                      { file: path, line: 1 },
                      'untracked',
                      `${path} is not tracked. Commit it, so the other checks and this check can read it.`,
                  ),
              );
}

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
        ...targets.map((target): [string, Buffer] => [target.path, readBytes(root, target.path)]),
    ]);
}

function stripScopePrefix(path: string, scope: string): string {
    const prefix = path.startsWith('**/') ? '**/' : '';
    const scopePath = path.slice(prefix.length);
    return scope !== '' && scopePath.startsWith(`${scope}/`) ? `${prefix}${scopePath.slice(scope.length + 1)}` : path;
}

function listGeneratorOutputs(
    session: Session,
    planned: PlannedCheck,
    values: Substitutions,
): { listed: GeneratorOutput[]; named: string[] } {
    const named: string[] = [];
    const generatorOutputs = (planned.check.generator_outputs ?? []).flatMap((output): GeneratorOutput[] => {
        const { kind, path: pattern } = output;
        const isNamed = kind === 'pattern' && pattern.includes('{setting:');
        const replaced = replacePlaceholders(session, planned, pattern, values);
        const path = isNamed ? stripScopePrefix(replaced, planned.scope.folder.path) : replaced;
        if (path === '') return [];
        if (isNamed) named.push(path);
        return [{ kind, path }];
    });
    return { listed: generatorOutputs, named };
}

function planGeneratorRun(session: Session, planned: PlannedCheck): GeneratorRun | undefined {
    const values = buildCommandSubstitutions(session.root, planned, join(session.root, planned.scope.folder.path));
    const declaration = planned.check.command ?? [];
    const command = expandCommand(session, planned, declaration, values);
    if (command.length === 0) return undefined;

    const { listed, named } = listGeneratorOutputs(session, planned, values);
    if (listed.length === 0) return undefined;
    const targets = listed.filter((output) => output.kind !== 'pattern');
    const patterns = listed.filter((output) => output.kind === 'pattern').map((output) => output.path);
    const isMatched = buildPathMatcher(patterns);
    const selected = planned.files
        .map((file) => posix.relative(planned.scope.folder.path, file.path))
        .filter((path) => isMatched(path));

    const commandText = command.filter((argument) => typeof argument === 'string').join(' ');
    return { values, commandText, declaration, patterns, named, targets, selected };
}

/**
Runs the declared generator in a copy and reports missing or changed generator output.

@param session the repository and its tools.
@param planned the generator check and its scope.
@returns one finding per missing or stale file.
*/
export async function checkGeneratorOutputs(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const run = planGeneratorRun(session, planned);
    if (run === undefined) return [];
    const { values, commandText, declaration, patterns, targets, selected } = run;
    const excluded = [...GENERATOR_IGNORED_FOLDERS, GSPOT_FOLDER].map((name) => `!**/${name}/**`);
    const untracked = listUntrackedOutputs(session, planned, run.named, excluded);
    if (untracked.length > 0) return untracked;
    if (targets.length + selected.length === 0) return [];
    const missing = listMissingOutputs(session, planned, targets, commandText);
    if (missing.length > 0) return missing;
    using folder = await createCheckCopy(
        session,
        planned,
        targets.map((target) => target.path),
    );
    const cwd = join(folder.path, planned.scope.folder.path);
    const outputFiles = { root: folder.path, scope: planned.scope.folder.path, patterns, targets, excluded };
    const stdoutPaths = new Set(targets.filter((target) => target.kind === 'stdout').map((target) => target.path));
    const before = new Map(
        readOutputContents(outputFiles)
            .entries()
            .map(([path, bytes]): [string, Buffer] => [
                path,
                stdoutPaths.has(path) ? Buffer.from(bytes.toString('utf8').trim()) : bytes,
            ]),
    );
    const commandArguments = expandCommand(session, planned, declaration, { ...values, root: folder.path });
    const commands = buildFileCommandLines(commandArguments, selected);
    let stdout = '';
    for (const commandLine of commands) {
        const result = await runCheckTool(session, planned, commandLine.commandArguments, { cwd });
        if (result.code !== 0) throw new Error(`The generator command failed: ${formatOutputTail(result)}`);
        stdout = result.stdout;
    }
    const after = readOutputContents(outputFiles);
    for (const path of stdoutPaths) after.set(path, Buffer.from(stdout.trim()));
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return was === undefined || now === undefined || !was.equals(now);
        })
        .toSorted((left, right) => compareText(left, right))
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'stale',
                `Running ${commandText} changes this generated file; commit what it writes.`,
            ),
        );
}
