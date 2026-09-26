import type { ToolPin } from '#cli/types/configurations.ts';
import { MISE_BACKENDS, HOST_HINTS, PLATFORM_INSTALLERS } from '#cli/constants/tools/tools.ts';

function platformHint(installers: ToolPin['installers']): string | undefined {
    const match = PLATFORM_INSTALLERS.find(
        ({ platform, installer }) => platform === process.platform && installers[installer] !== undefined,
    );
    return match === undefined ? undefined : `${match.command} ${installers[match.installer]?.name ?? ''}`;
}

/**
 * The installation command for managed tools, or platform guidance for a host tool.
 * @param tool the pin
 * @returns the hint
 */
export function installHint(tool: ToolPin): string {
    if (tool.provider === 'host') return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    if (MISE_BACKENDS.some(({ installer }) => tool.installers[installer] !== undefined)) return 'Run: gspot install';
    return (
        platformHint(tool.installers) ??
        (tool.version === undefined ? `install ${tool.name}` : `install ${tool.name} ${tool.version}`)
    );
}
