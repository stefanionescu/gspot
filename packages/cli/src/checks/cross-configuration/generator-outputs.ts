import { join, posix } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { type GeneratorOutput } from '#cli/types/manifests.ts';
import type { Substitutions } from '#cli/types/runs/command.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import type { GeneratorRun } from '#cli/types/checks/cross-configuration/cross-configuration.ts';
import { expandCommand, replacePlaceholders, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';
import { RULES, GENERATOR_IGNORED_FOLDERS } from '#cli/config/checks/cross-configuration/cross-configuration.ts';

function listMissingOutputs(
    session: Session,

    outputs: GeneratorOutput[],
    commandText: string,
): CheckFinding[] {
    return outputs
        .filter((target) => {
            try {
                readBytes(session.cache, target.path);
                return false;
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return true;
                throw error;
            }
        })
        .map((output) => ({
            file: output.path,
            line: 1,
            rule: RULES.missing,
            message: `The file ${output.path} does not exist; run ${commandText} and commit what it writes.`,
        }));
}

function listUntrackedOutputs(
    session: Session,
    planned: PlannedCheck,
    named: string[],
    excluded: string[],
): CheckFinding[] {
    const scope = planned.scope.path;
    const tracked = new Set(session.repository.index.map(({ path }) => path));
    return named.length === 0 || !session.repository.hasGit
        ? []
        : listMatchingPaths(join(session.root, scope), [...named, ...excluded])
              .map((path) => joinScope(scope, path))
              .filter((path) => !tracked.has(path))
              .toSorted((left, right) => compareText(left, right))
              .map((path) => ({
                  file: path,
                  line: 1,
                  rule: RULES.untracked,
                  message: `${path} is not tracked. Commit it, so the other checks and this check can read it.`,
              }));
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

function stripScopePrefix(path: string, scopePath: string): string {
    const prefix = path.startsWith('**/') ? '**/' : '';
    const relativePath = path.slice(prefix.length);
    return scopePath !== '' && relativePath.startsWith(`${scopePath}/`)
        ? `${prefix}${relativePath.slice(scopePath.length + 1)}`
        : path;
}

function listGeneratorOutputs(
    session: Session,
    planned: PlannedCheck,
    substitutions: Substitutions,
): { listed: GeneratorOutput[]; named: string[] } {
    const named: string[] = [];
    const generatorOutputs = (planned.check.generator_outputs ?? []).flatMap((output): GeneratorOutput[] => {
        const { kind, path: pattern } = output;
        const isNamed = kind === 'pattern' && pattern.includes('{setting:');
        const replaced = replacePlaceholders(session, planned, pattern, substitutions);
        const path = isNamed ? stripScopePrefix(replaced, planned.scope.path) : replaced;
        if (path === '') return [];
        if (isNamed) named.push(path);
        return [{ kind, path }];
    });
    return { listed: generatorOutputs, named };
}

function planGeneratorRun(session: Session, planned: PlannedCheck): GeneratorRun | undefined {
    const values = buildCommandSubstitutions(session.root, planned, join(session.root, planned.scope.path));
    const declaration = planned.check.command ?? [];
    const command = expandCommand(session, planned, declaration, values);
    if (command.length === 0) return undefined;

    const { listed, named } = listGeneratorOutputs(session, planned, values);
    if (listed.length === 0) return undefined;
    const targets = listed.filter((output) => output.kind !== 'pattern');
    const patterns = listed.filter((output) => output.kind === 'pattern').map((output) => output.path);
    const isMatched = buildPathMatcher(patterns);
    const selected = planned.files
        .map((file) => posix.relative(planned.scope.path, file.path))
        .filter((path) => isMatched(path));

    const commandText = command.filter((argument) => typeof argument === 'string').join(' ');
    return { substitutions: values, commandText, declaration, patterns, named, targets, selected };
}

/**
Runs the declared generator in a copy and reports missing or changed generator output.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkGeneratorOutputs(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const run = planGeneratorRun(session, planned);
    if (run === undefined) return [];
    const { substitutions: values, commandText, declaration, patterns, targets, selected } = run;
    const excluded = [...GENERATOR_IGNORED_FOLDERS, GSPOT_FOLDER].map((name) => `!**/${name}/**`);
    const untracked = listUntrackedOutputs(session, planned, run.named, excluded);
    if (untracked.length > 0) return untracked;
    if (targets.length + selected.length === 0) return [];
    const missing = listMissingOutputs(session, targets, commandText);
    if (missing.length > 0) return missing;
    using folder = await createCheckCopy(
        session,
        planned,
        targets.map((target) => target.path),
    );
    const cwd = join(folder.path, planned.scope.path);
    const outputFiles = { root: folder.path, scope: planned.scope.path, patterns, targets, excluded };
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
        if (result.code !== 0)
            throw new GspotError('check', `The generator command failed: ${formatOutputTail(result)}`);
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
        .map((path) => ({
            file: path,
            line: 1,
            rule: RULES.stale,
            message: `Running ${commandText} changes this generated file; commit what it writes.`,
        }));
}
