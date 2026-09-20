// Every lockfile matches its manifest: the package manager installs from it without wanting to change it.
import { dirname, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { FROZEN_INSTALLS } from '#config/integrity.ts';

const INSTALL_TIMEOUT_MS = 300_000;
const SHOWN_LINES = 3;

/**
 * One finding for each lockfile its package manager refuses to install from unchanged.
 * @param input the engine input
 * @returns the findings
 */
export async function lockfileFresh(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.session.repository.files) {
        const command = FROZEN_INSTALLS[file.path.slice(file.path.lastIndexOf('/') + 1)];
        if (command === undefined) continue;
        const result = await run(command, { cwd: join(input.root, dirname(file.path)), timeoutMs: INSTALL_TIMEOUT_MS });
        if (result.missing || result.code === 0) continue;
        const said = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
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
