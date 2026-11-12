import http from 'node:http';

import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import {
    MILLISECONDS_PER_DAY,
    NETWORK_ADVICE,
    NODE_PROXY_ADVICE,
    NOT_FOUND_STATUS,
    PROXY_VARIABLES,
    PYTHON_DEFAULT_INDEX_ORIGIN,
} from '#cli/config/tools/installers.ts';
import { npmReleaseSchema, pypiReleaseSchema } from '#cli/schemas/tools.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { GspotError } from '#cli/system/errors.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { runTool } from '#cli/tools/run.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type { ArchiveDownload, DownloadSession, ToolInstall, ToolRelease } from '#cli/types/tools.ts';

/**
Read the registry page of a release. A registry that gspot cannot reach, or that does not answer in time, gives no
page: fetch rejects with a TypeError for a network failure.
*/
async function readReleasePage(
    install: ToolInstall,
    release: ToolRelease,
): Promise<{ ok: boolean; status: number; text: string } | undefined> {
    try {
        const response = await fetch(release.url, {
            signal: AbortSignal.timeout(install.session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND),
        });
        return { ok: response.ok, status: response.status, text: await response.text() };
    } catch (error) {
        if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError'))
            return undefined;
        throw error;
    }
}

async function readReleaseState(install: ToolInstall, release: ToolRelease): Promise<'absent' | 'held' | undefined> {
    const page = await readReleasePage(install, release);
    if (page === undefined) return undefined;
    if (page.status === NOT_FOUND_STATUS) return 'absent';
    if (!page.ok) return undefined;
    const body: unknown = JSON.parse(page.text);
    const published =
        release.kind === 'npm'
            ? npmReleaseSchema.parse(body).time[release.version]
            : pypiReleaseSchema.parse(body).urls[0]?.upload_time_iso_8601;
    if (published === undefined) return 'absent';
    const oldest = Date.now() - install.releaseAgeDays * MILLISECONDS_PER_DAY;
    return new Date(published).getTime() > oldest ? 'held' : undefined;
}

function selectProxyAdvice(): string {
    if (PROXY_VARIABLES.every((name) => readEnvironmentVariable(name) === undefined)) return NETWORK_ADVICE;
    if (!('setGlobalProxyFromEnv' in http)) return NODE_PROXY_ADVICE;
    http.setGlobalProxyFromEnv();
    return NETWORK_ADVICE;
}

async function readBoundedArchive(response: Response, { url, name, limit }: ArchiveDownload): Promise<Buffer> {
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader();
    if (reader === undefined) throw new GspotError('install', `${url} sent no content for ${name}.`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks);
            size += value.length;
            if (size > limit) {
                await reader.cancel();
                throw new GspotError('install', `${url} exceeds the size limit for ${name}.`);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

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
    if (result.end === 'timed-out') {
        const elapsed = ((performance.now() - started) / MILLISECONDS_PER_SECOND).toFixed(1);
        throw new GspotError(
            'install',
            `Install stopped ${step} after ${elapsed}s, past tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
        );
    }
    return result;
}

export async function runRequiredInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: {
        cwd: string;
        env?: Record<string, string | undefined>;
        step: string;
        name: string;
        readAdvice?: (result: SpawnResult) => string;
    },
): Promise<SpawnResult> {
    const { name, readAdvice = () => NETWORK_ADVICE, ...spawn } = options;
    const result = await runInstallStep(install, command, spawn);
    const exit = result.signal === undefined ? `exit ${String(result.code)}` : `stopped by ${result.signal}`;
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `${name} failed (${exit}):\n${redactInstallOutput(result, [])}\n${readAdvice(result)}`,
        );
    return result;
}

export async function downloadArchive(session: DownloadSession, download: ArchiveDownload): Promise<Buffer> {
    const advice = selectProxyAdvice();
    try {
        const signals = [AbortSignal.timeout(session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND)];
        if (session.cancelSignal !== undefined) signals.push(session.cancelSignal);
        const response = await fetch(download.url, { signal: AbortSignal.any(signals) });
        if (!response.ok)
            throw new GspotError(
                'install',
                `Cannot download ${download.name} ${download.url} (HTTP ${String(response.status)}).`,
            );
        return await readBoundedArchive(response, download);
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (error instanceof GspotError) throw error;
        throw new GspotError('install', `Cannot download ${download.name} ${download.url}. ${advice}`, {
            cause: error,
        });
    }
}

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
and a release that the registry does not have needs another pin. A registry that answers with an error, that gspot
cannot reach, or that does not answer in time adds nothing.
*/
export async function explainReleaseAgeHold(
    install: ToolInstall,
    output: string,
    releases: readonly ToolRelease[],
): Promise<string> {
    const named = releases.filter((release) => output.includes(release.label));
    if (named.length === 0 || install.releaseAgeDays === 0) return '';
    const releaseStates = await Promise.all(
        named.map(async (release) => {
            return { label: release.label, state: await readReleaseState(install, release) };
        }),
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
