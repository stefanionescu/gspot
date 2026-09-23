import type { ToolPin } from '#cli/presets/types.ts';

/** Select the private installation used by both generated projects and tool resolution. */
export function privateToolInstallation(
    tool: ToolPin,
    runner?: string,
): { kind: 'npm' | 'python'; name: string; version: string } | undefined {
    if (tool.provider === 'host') return undefined;
    const python = tool.installers['pypi'];
    if (python?.version !== undefined) return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || (runner === 'mise' && tool.installers['mise'] !== undefined)) return undefined;
    return { kind: 'npm', name: npm.name, version: npm.version };
}
