import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import type { ToolInstall, ToolRelease } from '#cli/types/tools.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { npmReleaseSchema, pypiReleaseSchema } from '#cli/schemas/tools.ts';
import { NOT_FOUND_STATUS, MILLISECONDS_PER_DAY, PYTHON_DEFAULT_INDEX_ORIGIN } from '#cli/config/tools/installers.ts';

async function readReleaseState(install: ToolInstall, release: ToolRelease): Promise<'absent' | 'held' | undefined> {
    const response = await fetch(release.url, {
        signal: AbortSignal.timeout(install.session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND),
    });
    if (response.status === NOT_FOUND_STATUS) return 'absent';
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const published =
        release.kind === 'npm'
            ? npmReleaseSchema.parse(body).time[release.version]
            : pypiReleaseSchema.parse(body).urls[0]?.upload_time_iso_8601;
    if (published === undefined) return 'absent';
    const oldest = Date.now() - install.releaseAgeDays * MILLISECONDS_PER_DAY;
    return new Date(published).getTime() > oldest ? 'held' : undefined;
}

/**
Record and run one install command with the shared cancellation and time limit.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder, the environment, and the step that the command does.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
@param options.step what the command does, which gspot prints as it starts, for a command that can take a while.
*/
export async function runInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; step?: string },
): Promise<SpawnResult> {
    const { step = `the command ${command.join(' ')}`, ...spawn } = options;
    install.steps.push(command);
    if (options.step !== undefined) writeProgress(`${step}\n`);
    const timeoutSeconds = install.session.settings.tool_timeout_seconds;
    const started = performance.now();
    const result = await runTool(command, { ...spawn, cancelSignal: install.session.cancelSignal, timeoutSeconds });
    install.session.cancelSignal?.throwIfAborted();
    if (result.timedOut) {
        const elapsed = ((performance.now() - started) / MILLISECONDS_PER_SECOND).toFixed(1);
        throw new GspotError(
            'install',
            `Install stopped ${step} after ${elapsed}s, past tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
        );
    }
    return result;
}

/**
Record and run one install command, and stop when it exits with an error.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder, the environment, the step, and the name of the command in the error.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
@param options.step what the command does, which gspot prints as it starts.
@param options.name how the error names the command.
*/
export async function runRequiredInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; step: string; name: string },
): Promise<SpawnResult> {
    const { name, ...spawn } = options;
    const result = await runInstallStep(install, command, spawn);
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `${name} failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
        );
    return result;
}

/**
List the Python pins with the address of each release on the default index.

@param pins the pins, each written name==version.
*/
export function listPythonReleases(pins: readonly string[]): ToolRelease[] {
    return pins.map((pin) => {
        const [name, version] = pin.split('==') as [string, string];
        return {
            label: pin,
            kind: 'python',
            version,
            url: `${PYTHON_DEFAULT_INDEX_ORIGIN}/pypi/${name}/${version}/json`,
        };
    });
}

/**
Say why the registry refused pinned tools that a failed resolution names. A release inside the hold waits for its age,
and a release that the registry does not have needs another pin. A failed registry lookup adds nothing.

@param install the installation state with the hold.
@param output the redacted output of the package manager.
@param releases each pinned tool, with the registry address of its release.
@returns the explanation and a line break, or an empty string when the output names no pin.
*/
export async function explainReleaseAgeHold(
    install: ToolInstall,
    output: string,
    releases: readonly ToolRelease[],
): Promise<string> {
    const named = releases.filter((release) => output.includes(release.label));
    if (named.length === 0 || install.releaseAgeDays === 0) return '';
    const releaseStates = await Promise.all(
        named.map(async (release) => ({
            label: release.label,
            state: await readReleaseState(install, release).catch(() => undefined),
        })),
    );
    const absent = releaseStates.filter(({ state }) => state === 'absent').map(({ label }) => label);
    const held = releaseStates.filter(({ state }) => state === 'held').map(({ label }) => label);
    const days = String(install.releaseAgeDays);
    return [
        ...(absent.length === 0 ? [] : [`The registry has no release ${absent.join(', ')}.\n`]),
        ...(held.length === 0
            ? []
            : [
                  `${held.join(', ')} came out less than ${days} days ago. The setting dependencies.min_release_age_days holds back each release for ${days} days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n`,
              ]),
    ].join('');
}
