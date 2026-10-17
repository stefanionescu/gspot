import { z } from 'zod';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { GSPOT_PACKAGES } from '#cli/config/generation/file-edits.ts';
import type { InstallerPin, ToolDeclaration } from '#cli/types/configurations.ts';
import { DAY_MILLISECONDS, PUBLISH_TIME_APIS } from '#tests/data/tools/installation.ts';

/**
 * Call a registry API, and name the refusal when it answers with an error.
 * @param url the API address.
 * @param init the request headers.
 * @returns the response.
 * @throws when the registry refuses, for example GitHub without GITHUB_TOKEN after its rate limit.
 */
async function readRegistryResponse(url: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}: ${await response.text()}`);
    return response;
}

/**
 * Read when a tool's npm or PyPI version came out.
 * @param tool declaration with a version and installers.
 * @returns the publish time, or undefined when the tool has neither pin.
 */
async function readPackagePublishTime(tool: ToolDeclaration): Promise<string | undefined> {
    const { npm, pypi } = tool.installers;
    if (tool.version === undefined) return undefined;
    if (npm !== undefined) {
        const response = await readRegistryResponse(`${PUBLISH_TIME_APIS.npm}${npm.name.replace('/', '%2F')}`);
        return z.object({ time: z.record(z.string(), z.string()) }).parse(await response.json()).time[tool.version];
    }
    if (pypi === undefined) return undefined;
    const response = await readRegistryResponse(`${PUBLISH_TIME_APIS.pypi}${pypi.name}/${tool.version}/json`);
    const files = z
        .object({ urls: z.array(z.object({ upload_time_iso_8601: z.string() })) })
        .parse(await response.json());
    return files.urls.map((file) => file.upload_time_iso_8601).toSorted((left, right) => left.localeCompare(right))[0];
}

/**
 * Read when a tool's GitHub release came out.
 * @param github repository and release tag.
 * @returns the publish time.
 */
async function readReleasePublishTime(github: InstallerPin & { version: string }): Promise<string> {
    const token = readEnvironmentVariable('GITHUB_TOKEN');
    const response = await readRegistryResponse(
        `${PUBLISH_TIME_APIS.github}${github.name}/releases/tags/${github.version}`,
        {
            headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
        },
    );
    return z.object({ published_at: z.string() }).parse(await response.json()).published_at;
}

/**
 * Read when every pinned version of a tool came out.
 * @param tool declaration to look up.
 * @returns one publish time for each registry that pins the tool.
 * @throws when a registry has no such version.
 */
async function readPublishTimes(tool: ToolDeclaration): Promise<string[]> {
    const { github, npm, pypi } = tool.installers;
    const times = [await readPackagePublishTime(tool)];
    if (github?.version !== undefined) times.push(await readReleasePublishTime({ ...github, version: github.version }));
    if (times[0] === undefined && tool.version !== undefined && (npm !== undefined || pypi !== undefined))
        throw new Error(`No registry reports ${tool.name} ${tool.version}.`);
    return times.filter((time) => time !== undefined);
}

test('every pinned tool version is older than the default release hold, except our own packages', async () => {
    const tools = listDistinctTools([...readManifests(createReadCache(process.cwd())).values()]).filter((tool) =>
        GSPOT_PACKAGES.every((name) => name !== tool.installers['npm']?.name),
    );
    const now = Date.now();
    const ages = await Promise.all(
        tools.map(async (tool) => {
            const times = await readPublishTimes(tool);
            return {
                tool: tool.name,
                days: Math.min(...times.map((time) => (now - Date.parse(time)) / DAY_MILLISECONDS)),
            };
        }),
    );
    expect(ages.filter(({ days }) => days < SETTING_DEFAULTS.min_release_age_days)).toStrictEqual([]);
});

test('npm reads both gspot packages from the release hold excludes that apply writes', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies']),
        'package.json': '{"private":true}\n',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}\n',
    });
    commitAll(repository.path);
    const applied = await spawnGspot(repository.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const excludes = await runCommand(['npm', 'config', 'get', 'min-release-age-exclude'], { cwd: repository.path });
    expect(excludes.stdout.trim().split(',')).toStrictEqual([...GSPOT_PACKAGES]);
});
