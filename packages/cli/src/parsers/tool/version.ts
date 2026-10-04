import semver from 'semver';
import { stripVTControlCharacters } from 'node:util';
import type { ToolPin } from '#cli/types/configurations.ts';
import { NO_VERSION } from '#cli/config/parsers/tool/version.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { ParsedToolVersion } from '#cli/types/parsers/tool-version.ts';

function parsedVersion(text: string, tool: ToolPin): string | undefined {
    if (tool.version_pattern === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_pattern, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function versionFailure(result: SpawnResult, tool: ToolPin, text: string): ParsedToolVersion | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing || text.includes(NO_VERSION)) return { state: 'missing', note: text };
    if (result.code !== (tool.version_exit_code ?? 0))
        return { state: 'error', note: `${tool.name} version inspection exited ${String(result.code)}: ${text}` };
    return undefined;
}

/**
 * Interpret an executable version response for both installation and later inspections.
 * @param tool the pin.
 * @param result what the version command printed and how it exited.
 * @param installedPackage the version the private npm package declares, when the tool is one.
 * @param installedMiseVersion the version mise installed, when the tool is a mise tool.
 * @returns the version, or the state and note of a tool that gave none.
 */
export function parseVersionOutput(
    tool: ToolPin,
    result: SpawnResult,
    installedPackage?: string,
    installedMiseVersion?: string,
): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    // A shim with no selected version starts nothing, regardless of other mise installations.
    const failure = versionFailure(result, tool, text);
    if (failure !== undefined) return failure;
    const version =
        (npm?.version === tool.version ? installedPackage : undefined) ??
        installedMiseVersion ??
        parsedVersion(text, tool);
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}
