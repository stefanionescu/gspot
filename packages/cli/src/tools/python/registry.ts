import { parse } from 'smol-toml';
import { HTTP_URL } from '#cli/config/tools/install.ts';
import { registryPasswords } from '#cli/tools/credentials.ts';
import { isAbsolute, resolve as absolutePath } from 'node:path';
import { URL_SCHEME, INDEX_SETTINGS } from '#cli/config/tools/python.ts';
import type { PythonIndexSettings, PythonSettingsSources } from '#cli/types/tools/python.ts';

import {
    uvIndexSchema,
    uvIndexesSchema,
    uvFindLinksSchema,
    uvProjectSettingsSchema,
} from '#cli/parsers/schema/python/tools.ts';

// Preserve absolute URLs and paths; resolve an authored local index against its repository.
function indexLocation(root: string, value: string): string {
    if (URL_SCHEME.test(value)) return value;
    if (isAbsolute(value)) return value;
    return absolutePath(root, value);
}

/**
 * Read repository index settings and resolve their local paths for a temporary uv project.
 * @param root the repository root for resolving local index paths
 * @param sources the authored uv.toml and pyproject.toml contents
 * @returns selected settings and passwords excluded from generated lockfiles and diagnostics
 */
export function parsePythonSettings(root: string, sources: PythonSettingsSources): PythonIndexSettings {
    const parsed = parse(sources.uv ?? sources.project ?? '');
    const table = sources.uv === undefined ? uvProjectSettingsSchema.parse(parsed).tool.uv : parsed;
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = uvFindLinksSchema
            .parse(selected['find-links'])
            .map((value) => indexLocation(root, value));
    if (selected['index'] !== undefined)
        selected['index'] = uvIndexesSchema.parse(selected['index']).map((index) => ({
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
