import { dirname, join } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import { SHOWN_LINES } from '#cli/constants/checks/nextjs.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { createFileWorkspace } from '#cli/execution/file-workspace.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { FROZEN_INSTALLS, STALE_LOCK_DIAGNOSTICS } from '#cli/constants/checks/dependencies.ts';

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
        const filename = file.path.slice(file.path.lastIndexOf('/') + 1);
        const command =
            filename === 'yarn.lock' &&
            /^__metadata:/mu.test(readSource(input.root, file.path, input.observations).toString('utf8'))
                ? ['yarn', 'install', '--immutable']
                : FROZEN_INSTALLS[filename];
        if (command === undefined) continue;
        const result = await runCheckCommand(input, command, {
            cwd: join(workspace.root, dirname(file.path)),
            ...(filename === 'yarn.lock' ? { env: { YARN_ENABLE_SCRIPTS: 'false' } } : {}),
        });
        if (result.code === 0) continue;
        const said = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
        const [manager] = command;
        const staleDiagnostic = manager === undefined ? undefined : STALE_LOCK_DIAGNOSTICS[manager];
        if (staleDiagnostic === undefined)
            throw new Error(`No stale lockfile diagnostic is known for ${command.join(' ')}.`);
        if (!staleDiagnostic.test(said.join('\n')))
            throw new Error(
                `${command.join(' ')} could not validate the lockfile: ${said.slice(0, SHOWN_LINES).join(' ')}`,
            );
        findings.push({
            check: input.spec.name,
            file: file.path,
            line: 1,
            rule: 'stale-lockfile',
            message: `${command.join(' ')} refuses this lockfile: ${said.slice(0, SHOWN_LINES).join(' ')}`,
            fixable: false,
        });
    }
    return findings;
}
