import type { ToolPin } from '#types/manifest.ts';
import type { RunnerTool } from '#types/config.ts';
// The install command for a tool on this platform: mise first, then the platform's manager.
import { MISE_BACKENDS } from '#config/installers.ts';

const HOST_HINTS: Record<string, string> = {
    xcodebuild: 'install Xcode from the App Store',
    plutil: 'install Xcode from the App Store',
    xcstringstool: 'install Xcode from the App Store',
    docker: 'install Docker Desktop or the docker engine',
    bash: "install bash through your platform's package manager",
};
const NPM_RUNNERS = new Set(['npm', 'bun', 'pnpm']);
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

function cargoHint(installers: ToolPin['installers']): string | undefined {
    const pin = installers['cargo'];
    if (pin === undefined) return undefined;
    const version = pin.version === undefined ? '' : ` --version ${pin.version}`;
    return `cargo install ${pin.name}${version}`;
}

function githubHint(tool: ToolPin): string | undefined {
    const { installers } = tool;
    const pin = installers['github'];
    if (pin === undefined) return undefined;
    return `mise use github:${pin.name}@${pin.version ?? 'latest'}`;
}

function packageHint(tool: ToolPin, runner: RunnerTool): string | undefined {
    const { installers } = tool;
    if (installers['npm'] !== undefined) return `${NPM_RUNNERS.has(runner) ? runner : 'bun'} install`;
    const python = installers['pypi'];
    if (python === undefined) return undefined;
    if (runner === 'uv') return 'uv sync --group gspot';
    const version = python.version === undefined ? '' : `==${python.version}`;
    return `uv tool install ${python.name}${version}`;
}

function hasMiseInstaller(tool: ToolPin): boolean {
    return MISE_BACKENDS.some(({ installer }) => tool.installers[installer] !== undefined);
}

function installerHint(tool: ToolPin, runner: RunnerTool): string | undefined {
    return packageHint(tool, runner) ?? platformHint(tool.installers) ?? cargoHint(tool.installers) ?? githubHint(tool);
}

function plainHint(tool: ToolPin): string {
    return tool.version === undefined ? `install ${tool.name}` : `install ${tool.name} ${tool.version}`;
}

/**
 * The one line doctor prints under a missing tool.
 * @param tool the pin
 * @param runner the task runner the repository uses
 * @returns the command to run
 */
export function installHint(tool: ToolPin, runner: RunnerTool = 'mise'): string {
    if (tool.provider === 'host') return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    if (runner === 'mise' && hasMiseInstaller(tool)) return 'mise install';
    return installerHint(tool, runner) ?? plainHint(tool);
}
