import type { ToolPin } from '#cli/types/configurations.ts';
import type { PrivateToolPackage } from '#cli/types/tools/install.ts';

/**
 * Select the private installation used by both generated projects and tool resolution.
 * @param tool the pin
 * @param runner the task runner; under mise, tools mise can pin stay out
 * @returns the package to install privately, or undefined for an unpinned host tool or one mise pins
 */
export function privateToolInstallation(tool: ToolPin, runner?: string): PrivateToolPackage | undefined {
    const python = tool.installers['pypi'];
    if (tool.system !== true && python?.version !== undefined)
        return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || (runner === 'mise' && tool.installers['mise'] !== undefined)) return undefined;
    return { kind: 'npm', name: npm.name, version: npm.version };
}
