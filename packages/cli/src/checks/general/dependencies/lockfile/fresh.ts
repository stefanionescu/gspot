import { join, posix, dirname } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { LOCKFILE_DIAGNOSTIC_LINES, STALE_LOCKFILE_DIAGNOSTICS } from '#cli/config/checks/general/dependencies.ts';

// Yarn 2 and later use --immutable; other formats use the native command declared in the lockfile registry.
function frozenCommand(input: CheckInput, path: string): string[] | undefined {
    const filename = posix.basename(path);
    if (filename === 'yarn.lock' && /^__metadata:/mu.test(readSource(input.root, path, input.reads).toString('utf8')))
        return ['yarn', 'install', '--immutable'];
    const lockfile = lockfileEntry(filename);
    return lockfile !== undefined && 'frozen' in lockfile ? [...lockfile.frozen] : undefined;
}

// A frozen-installation failure is a finding only when the package manager identifies stale inputs.
function lockfileRefusal(command: string[], result: SpawnResult): string {
    const outputLines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const [client] = command;
    const staleDiagnostic = client === undefined ? undefined : STALE_LOCKFILE_DIAGNOSTICS[client];
    if (staleDiagnostic === undefined)
        throw new Error(`No stale lockfile diagnostic is known for ${command.join(' ')}.`);
    if (!staleDiagnostic.test(outputLines.join('\n')))
        throw new Error(
            `${command.join(' ')} could not validate the lockfile: ${outputLines.slice(0, LOCKFILE_DIAGNOSTIC_LINES).join(' ')}`,
        );
    return `${command.join(' ')} refuses this lockfile: ${outputLines.slice(0, LOCKFILE_DIAGNOSTIC_LINES).join(' ')}`;
}

/**
 * One finding for each lockfile its package manager refuses to install from unchanged.
 * @param input the check input
 * @returns the findings
 */
export async function lockfileFresh(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Package managers can write installation metadata even when they refuse a frozen lockfile.
    using workspace = await copyIntoScratch({
        root: input.root,
        paths: input.files.map((file) => file.path),
        dependencies: [],
    });
    for (const file of input.files) {
        const command = frozenCommand(input, file.path);
        if (command === undefined) continue;
        const result = await runCheckTool(input, command, {
            cwd: join(workspace.path, dirname(file.path)),
            ...(command[0] === 'yarn' ? { env: { YARN_ENABLE_SCRIPTS: 'false' } } : {}),
        });
        if (result.code === 0) continue;
        const refusal = lockfileRefusal(command, result);
        findings.push(findingAt(input, { file: file.path, line: 1 }, 'stale', refusal));
    }
    return findings;
}
