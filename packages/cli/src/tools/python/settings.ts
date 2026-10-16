import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { parse, stringify } from 'smol-toml';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { HTTP_URL } from '#cli/config/tools/diagnostics.ts';
import { registryPasswords } from '#cli/tools/diagnostics.ts';
import { join, isAbsolute, resolve as absolutePath } from 'node:path';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { URL_SCHEME, INDEX_SETTINGS, UV_SETTINGS_FILE } from '#cli/config/tools/python.ts';
import type { PythonIndexSettings, PythonSettingsSources } from '#cli/types/tools/project.ts';

// Preserve absolute URLs and paths; resolve an authored local index against its repository.
function indexLocation(root: string, value: string): string {
    if (URL_SCHEME.test(value)) return value;
    if (isAbsolute(value)) return value;
    return absolutePath(root, value);
}

const uvProjectSettingsSchema = z.object({
    tool: z
        .object({
            uv: z.record(z.string(), z.unknown()).default({}),
        } satisfies SchemaShape<
            { uv: PythonIndexSettings['settings'] },
            { uv?: PythonIndexSettings['settings'] | undefined }
        >)
        .default({ uv: {} }),
} satisfies SchemaShape<
    { tool: { uv: PythonIndexSettings['settings'] } },
    { tool?: { uv?: PythonIndexSettings['settings'] | undefined } | undefined }
>);

const uvIndexSchema = z.looseObject({ url: z.string() } satisfies SchemaShape<{ url: string }>);

/**
 * Copy repository uv index settings into the scratch folder, make relative paths absolute, and collect registry credentials.
 *
 * @param root the repository root.
 * @param work the directory the resolution runs in.
 *
 * @returns index credentials that must remain absent from generated lockfiles.
 */
export function writePythonSettings(root: string, work: string): string[] {
    const { settings, credentials } = parsePythonSettings(root, {
        uv: readText(root, UV_SETTINGS_FILE),
        project: readText(root, PYPROJECT_TOML),
    });
    writeFileSync(join(work, UV_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return credentials;
}

/**
 * Read repository index settings and resolve their local paths for a temporary uv project.
 *
 * @param root the repository root for resolving local index paths.
 * @param sources the authored uv.toml and pyproject.toml contents.
 *
 * @returns selected settings and passwords excluded from generated lockfiles and diagnostics.
 */
export function parsePythonSettings(root: string, sources: PythonSettingsSources): PythonIndexSettings {
    const parsed = parse(sources.uv ?? sources.project ?? '');
    const table = sources.uv === undefined ? uvProjectSettingsSchema.parse(parsed).tool.uv : parsed;
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = z
            .array(z.string())
            .parse(selected['find-links'])
            .map((value) => indexLocation(root, value));
    if (selected['index'] !== undefined)
        selected['index'] = z
            .array(uvIndexSchema)
            .parse(selected['index'])
            .map((index) => ({
                ...index,
                url: indexLocation(root, index.url),
            }));
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const entries: unknown[] = Array.isArray(value) ? value : [value];
        const settingEntries =
            key === 'index'
                ? entries.map((entry) => uvIndexSchema.parse(entry).url)
                : entries.filter((entry) => typeof entry === 'string');
        return settingEntries.filter((value) => HTTP_URL.test(value)).flatMap((value) => registryPasswords(value));
    });
    return { settings: selected, credentials };
}
