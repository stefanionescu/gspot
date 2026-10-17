// Read Python index settings for an isolated install.
import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { HTTP_URL } from '#cli/config/tools/credentials.ts';
import { extractUrlPasswords } from '#cli/tools/credentials.ts';
import { join, isAbsolute, resolve as absolutePath } from 'node:path';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { URL_SCHEME, INDEX_SETTINGS, UV_SETTINGS_FILE } from '#cli/config/tools/python.ts';
import type { PythonIndexSettings, PythonSettingsSources } from '#cli/types/tools/project.ts';

// Preserve absolute URLs and paths; resolve an authored local index against its repository.
function normalizeIndexLocation(root: string, value: string): string {
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
 * @param repositoryRoot the base folder for reading uv settings and resolving local index paths.
 * @param work the folder where the resolution runs.
 *
 * @returns index credentials that must stay out of generated lockfiles.
 */
export function writePythonSettings(repositoryRoot: string, work: string): string[] {
    const { settings, credentials } = parsePythonSettings(repositoryRoot, {
        uv: readText(repositoryRoot, UV_SETTINGS_FILE),
        project: readText(repositoryRoot, PYPROJECT_TOML),
    });
    writeFileSync(join(work, UV_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return credentials;
}

/**
 * Read repository index settings and resolve their local paths for a temporary uv project.
 *
 * @param repositoryRoot the base for local index paths.
 * @param sources the authored uv.toml and pyproject.toml contents.
 *
 * @returns the index settings, and the passwords to keep out of generated lockfiles and messages.
 */
export function parsePythonSettings(repositoryRoot: string, sources: PythonSettingsSources): PythonIndexSettings {
    const parsed = parse(sources.uv ?? sources.project ?? '') as Record<string, unknown>;
    const table = sources.uv === undefined ? uvProjectSettingsSchema.parse(parsed).tool.uv : parsed;
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = z
            .array(z.string())
            .parse(selected['find-links'])
            .map((value) => normalizeIndexLocation(repositoryRoot, value));
    const indexes =
        selected['index'] === undefined
            ? []
            : z
                  .array(uvIndexSchema)
                  .parse(selected['index'])
                  .map((index) => ({ ...index, url: normalizeIndexLocation(repositoryRoot, index.url) }));
    if (selected['index'] !== undefined) selected['index'] = indexes;
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const entries: unknown[] = Array.isArray(value) ? value : [value];
        const settingEntries =
            key === 'index' ? indexes.map((index) => index.url) : entries.filter((entry) => typeof entry === 'string');
        return settingEntries.filter((value) => HTTP_URL.test(value)).flatMap((value) => extractUrlPasswords(value));
    });
    return { settings: selected, credentials };
}
