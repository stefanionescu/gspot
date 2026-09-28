// Whether a tool has a build for the host: its pin names the platforms it ships for, or names none and ships everywhere.
import type { ToolPin } from '#cli/types/kits.ts';
import { PLATFORM_LABELS } from '#cli/config/execution/execution.ts';

/**
 * The build a tool lacks on a host, such as Windows or arm64 Linux, or undefined when the tool ships for it.
 * @param tool the tool pin
 * @param platform the host platform name: macos, linux, or windows
 * @param arch the host architecture: x64 or arm64
 * @returns the words for the missing build, or undefined
 */
export function missingBuild(tool: ToolPin, platform: string, arch: string): string | undefined {
    const named: readonly string[] = tool.platforms ?? [];
    if (tool.platforms === undefined || named.includes(platform) || named.includes(`${platform}-${arch}`))
        return undefined;
    const label = PLATFORM_LABELS[platform] ?? platform;
    // A pin that names the operating system with another architecture lacks this architecture only.
    return named.some((entry) => entry.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}
