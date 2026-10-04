import { join, posix, dirname } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { SHOWN_LINES } from '#cli/config/checks/framework/nextjs.ts';
import { createFileWorkspace } from '#cli/execution/snapshot/workspace.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { FROZEN_INSTALLS, STALE_LOCK_DIAGNOSTICS } from '#cli/config/checks/general/dependencies.ts';

// Yarn metadata selects its immutable-installation protocol. Other filenames select their pinned client command.
function frozenCommand(input: EngineInput, path: string): string[] | undefined {
    const filename = posix.basename(path);
    if (filename === 'yarn.lock' && /^__metadata:/mu.test(readSource(input.root, path, input.reads).toString('utf8')))
        return ['yarn', 'install', '--immutable'];
    return FROZEN_INSTALLS[filename];
}

// A frozen-installation failure is a finding only when the package manager identifies stale inputs.
function lockfileRefusal(command: string[], result: SpawnResult): string {
    const said = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const [client] = command;
    const staleDiagnostic = client === undefined ? undefined : STALE_LOCK_DIAGNOSTICS[client];
    if (staleDiagnostic === undefined)
        throw new Error(`No stale lockfile diagnostic is known for ${command.join(' ')}.`);
    if (!staleDiagnostic.test(said.join('\n')))
        throw new Error(
            `${command.join(' ')} could not validate the lockfile: ${said.slice(0, SHOWN_LINES).join(' ')}`,
        );
    return `${command.join(' ')} refuses this lockfile: ${said.slice(0, SHOWN_LINES).join(' ')}`;
}

/**
 * One finding for each lockfile its package manager refuses to install from unchanged.
 * @param input the engine input
 * @returns the findings
 */
export async function lockfileFresh(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Package managers can write installation metadata even when they refuse a frozen lock.
    using workspace = createFileWorkspace(
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
