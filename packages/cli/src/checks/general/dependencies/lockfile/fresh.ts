import { join, posix, dirname } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { copyFiles } from '#cli/execution/copy/files.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { STALE_LOCK_DIAGNOSTICS, LOCKFILE_DIAGNOSTIC_LINES } from '#cli/config/checks/general/dependencies.ts';

// Yarn 2 and later use --immutable; other formats use the native command declared in the lockfile registry.
function frozenCommand(input: EngineInput, path: string): string[] | undefined {
    const filename = posix.basename(path);
    if (filename === 'yarn.lock' && /^__metadata:/mu.test(readSource(input.root, path, input.reads).toString('utf8')))
        return ['yarn', 'install', '--immutable'];
    const lock = lockfileEntry(filename);
    return lock !== undefined && 'frozen' in lock ? [...lock.frozen] : undefined;
}

// A frozen-installation failure is a finding only when the package manager identifies stale inputs.
function lockfileRefusal(command: string[], result: SpawnResult): string {
    const outputLines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const [client] = command;
    const staleDiagnostic = client === undefined ? undefined : STALE_LOCK_DIAGNOSTICS[client];
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
 * @param input the engine input
 * @returns the findings
 */
export async function lockfileFresh(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Package managers can write installation metadata even when they refuse a frozen lock.
    using workspace = copyFiles(
        input.root,
        input.files.map((file) => file.path),
    );
    for (const file of input.files) {
        const command = frozenCommand(input, file.path);
        if (command === undefined) continue;
        const result = await runEngineTool(input, command, {
            cwd: join(workspace.root, dirname(file.path)),
            ...(command[0] === 'yarn' ? { env: { YARN_ENABLE_SCRIPTS: 'false' } } : {}),
        });
        if (result.code === 0) continue;
        const refusal = lockfileRefusal(command, result);
        findings.push(findingAt(input, { file: file.path, line: 1 }, 'stale', refusal));
    }
    return findings;
}
