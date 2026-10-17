import { z } from 'zod';
import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { GSPOT_PACKAGES } from '#cli/config/generation/file-edits.ts';
import type { InstallerPin, ToolDeclaration } from '#cli/types/configurations.ts';
import { DAY_MILLISECONDS, PUBLISH_TIME_APIS } from '#tests/data/tools/installation.ts';

/**
 * Read when a tool's npm or PyPI version came out.
 * @param tool declaration with a version and installers.
 * @returns the publish time, or undefined when the tool has neither pin.
 */
async function readPackagePublishTime(tool: ToolDeclaration): Promise<string | undefined> {
    const { npm, pypi } = tool.installers;
    if (tool.version === undefined) return undefined;
    if (npm !== undefined) {
        const response = await fetch(`${PUBLISH_TIME_APIS.npm}${npm.name.replace('/', '%2F')}`);
        return z.object({ time: z.record(z.string(), z.string()) }).parse(await response.json()).time[tool.version];
    }
    if (pypi === undefined) return undefined;
    const response = await fetch(`${PUBLISH_TIME_APIS.pypi}${pypi.name}/${tool.version}/json`);
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
    const response = await fetch(`${PUBLISH_TIME_APIS.github}${github.name}/releases/tags/${github.version}`, {
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    });
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
