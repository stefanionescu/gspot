import { MISE_BACKENDS } from '#cli/tools/installation.ts';
import type { ToolPin } from '#cli/configurations/read-manifests.ts';

const HOST_HINTS: Record<string, string> = {
    xcodebuild: 'install Xcode from the App Store',
    plutil: 'install Xcode from the App Store',
    xcstringstool: 'install Xcode from the App Store',
    docker: 'install Docker Desktop or the docker engine',
    bash: "install bash through your platform's package manager",
};
const PLATFORM_INSTALLERS: { platform: NodeJS.Platform; installer: string; command: string }[] = [
    { platform: 'darwin', installer: 'brew', command: 'brew install' },
    { platform: 'linux', installer: 'apt', command: 'sudo apt install' },
    { platform: 'win32', installer: 'winget', command: 'winget install' },
    { platform: 'win32', installer: 'scoop', command: 'scoop install' },
];

function platformHint(installers: ToolPin['installers']): string | undefined {
    const match = PLATFORM_INSTALLERS.find(
        ({ platform, installer }) => platform === process.platform && installers[installer] !== undefined,
    );
    return match === undefined ? undefined : `${match.command} ${installers[match.installer]?.name ?? ''}`;
}

/**
 * The installation command for managed tools, or platform guidance for a host tool.
 * @param tool
 */
export function installHint(tool: ToolPin): string {
    if (tool.provider === 'host') return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    if (MISE_BACKENDS.some(({ installer }) => tool.installers[installer] !== undefined)) return 'Run: gspot install';
    return (
        platformHint(tool.installers) ??
        (tool.version === undefined ? `install ${tool.name}` : `install ${tool.name} ${tool.version}`)
    );
}
