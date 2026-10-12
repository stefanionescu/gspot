import { join, posix, dirname } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { YARN_SCRIPTS_OFF, LOCKFILE_DIAGNOSTIC_LINES } from '#cli/config/checks/general/dependencies.ts';
import { YARN_LOCKFILE, YARN_BERRY_FROZEN, YARN_BERRY_LOCKFILE } from '#cli/config/parsers/lockfiles.ts';

// Yarn 2 and later use --immutable; other formats use the command declared for the lockfile format.
function frozenCommand(input: CheckInput, path: string, frozen: readonly string[]): string[] {
    const filename = posix.basename(path);
    if (
        filename === YARN_LOCKFILE &&
        YARN_BERRY_LOCKFILE.test(readSource(input.root, path, input.reads).toString('utf8'))
    )
        return [...YARN_BERRY_FROZEN];
    return [...frozen];
}

// Report a frozen installation failure only when the package manager identifies stale inputs.
function lockfileRefusal(command: string[], result: SpawnResult, staleDiagnostic: RegExp): string {
    const outputLines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    if (!staleDiagnostic.test(outputLines.join('\n')))
        throw new Error(
            `${command.join(' ')} could not validate the lockfile: ${outputLines.slice(0, LOCKFILE_DIAGNOSTIC_LINES).join(' ')}`,
        );
    return `${command.join(' ')} refuses this lockfile: ${outputLines.slice(0, LOCKFILE_DIAGNOSTIC_LINES).join(' ')}`;
}

/**
 * One finding for each lockfile its package manager refuses to install from unchanged.
 * @param input the check input.
 * @returns the findings.
 */
export async function staleLockfile(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Package managers can write installation metadata even when they refuse a frozen lockfile.
    using scratch = await copyIntoScratch({
        root: input.root,
        paths: input.files.map((file) => file.path),
        dependencies: [],
    });
    for (const file of input.files.filter((entry) => entry.kind === 'source')) {
        const lockfile = lockfileEntry(posix.basename(file.path));
        if (lockfile === undefined || !('frozen' in lockfile)) continue;
        const command = frozenCommand(input, file.path, lockfile.frozen);
        const result = await runCheckTool(input, command, {
            cwd: join(scratch.path, dirname(file.path)),
            ...(command[0] === 'yarn' ? { env: YARN_SCRIPTS_OFF } : {}),
        });
        if (result.code === 0) continue;
        const refusal = lockfileRefusal(command, result, lockfile.stale);
        findings.push(findingAt(input, { file: file.path, line: 1 }, 'stale', refusal));
    }
    return findings;
}
