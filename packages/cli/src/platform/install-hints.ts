// The install command for a tool on this platform: mise first, then the platform's manager.
import type { ToolPin } from '#types/manifest.ts';

/** The one line doctor prints under a missing tool. */
export function installHint(tool: ToolPin, runner: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none' = 'mise'): string {
    const { installers } = tool;
    if (tool.provider === 'host') {
        if (tool.name === 'xcodebuild' || tool.name === 'plutil' || tool.name === 'xcstringstool')
            return 'install Xcode from the App Store';
        if (tool.name === 'docker') return 'install Docker Desktop or the docker engine';
        if (tool.name === 'bash') return "install bash through your platform's package manager";
        return `install ${tool.name}`;
    }
    if (
        runner === 'mise' &&
        (installers['mise'] || installers['npm'] || installers['pypi'] || installers['ubi'] || installers['github'])
    )
        return 'mise install';
    if (installers['npm']) {
        const manager = runner === 'npm' || runner === 'bun' || runner === 'pnpm' ? runner : 'bun';
        return `${manager} install`;
    }
    if (installers['pypi']) return runner === 'uv' ? 'uv sync --group gspot' : `uv tool install ${installers['pypi']}`;
    if (process.platform === 'darwin' && installers['brew']) return `brew install ${installers['brew']}`;
    if (process.platform === 'linux' && installers['apt']) return `sudo apt install ${installers['apt']}`;
    if (process.platform === 'win32' && installers['winget']) return `winget install ${installers['winget']}`;
    if (process.platform === 'win32' && installers['scoop']) return `scoop install ${installers['scoop']}`;
    if (installers['cargo']) return `cargo install ${installers['cargo']}`;
    if (installers['github'])
        return `mise use ${installers['ubi'] ? `ubi:${installers['ubi']}` : `github:${installers['github']}`}@${tool.version ?? 'latest'}`;
    return `install ${tool.name}${tool.version ? ` ${tool.version}` : ''}`;
}
