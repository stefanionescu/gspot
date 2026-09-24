// Every lockfile matches its manifest: the package manager installs from it without wanting to change it.
import { dirname, join } from 'node:path';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { createFileWorkspace } from '#cli/run/file-workspace.ts';

const SHOWN_LINES = 3;
const STALE_LOCK_DIAGNOSTICS: Record<string, RegExp> = {
    bun: /lockfile had changes, but lockfile is frozen/u,
    npm: /can only install packages when your package\.json and package-lock\.json or npm-shrinkwrap\.json are in sync/u,
    pnpm: /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE)/u,
    uv: /lockfile[\s\S]*needs to be updated/u,
    yarn: /Your lockfile needs to be updated|YN0028|lockfile would have been modified/u,
};

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
        if (!STALE_LOCK_DIAGNOSTICS[command[0]!]!.test(said.join('\n')))
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

const FROZEN_INSTALLS: Record<string, string[]> = {
    'bun.lock': ['bun', 'install', '--frozen-lockfile', '--dry-run'],
    'package-lock.json': ['npm', 'ci', '--dry-run', '--ignore-scripts'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
    'uv.lock': ['uv', 'lock', '--check'],
};
