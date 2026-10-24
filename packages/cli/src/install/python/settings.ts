import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify } from '@decimalturn/toml-patch';
import { findText } from '#cli/system/files/reads.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { HTTP_URL } from '#cli/config/install/npm/lockfiles.ts';
import { extractUrlPasswords } from '#cli/install/credentials.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import type { PythonIndexSettings } from '#cli/types/install/python.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { uvSettingsSchema, uvProjectSettingsSchema } from '#cli/schemas/install/python/settings.ts';

import {
    URL_SCHEME,
    INDEX_SETTINGS,
    UV_SETTINGS_FILE,
    MILLISECONDS_PER_DAY,
} from '#cli/config/install/python/settings.ts';

function normalizeIndexLocation(root: string, location: string): string {
    if (URL_SCHEME.test(location)) return location;
    return resolve(root, location);
}

/**
Copy repository uv index settings into the temporary folder, make relative paths absolute, and collect registry
credentials.

@param repositoryRoot the base folder for reading uv settings and resolving local index paths.
@param settingsFolder the folder where the resolution runs.
@param days the minimum age of a release, in days.
@returns index credentials that must stay out of generated lockfiles.
*/
export function writePythonSettings(repositoryRoot: string, settingsFolder: string, days: number): string[] {
    const { settings, credentials } = readPythonSettings(repositoryRoot);
    settings['exclude-newer'] = new Date(Date.now() - days * MILLISECONDS_PER_DAY).toISOString();
    writeFileSync(join(settingsFolder, UV_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return credentials;
}

/**
Read repository index settings and resolve their local paths for a temporary uv project.

@param repositoryRoot the base for local index paths.
@returns the index settings, and the passwords to keep out of generated lockfiles and messages.
*/
export function readPythonSettings(repositoryRoot: string): PythonIndexSettings {
    const uv = findText(repositoryRoot, UV_SETTINGS_FILE);
    const project = findText(repositoryRoot, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (table['find-links'] !== undefined)
        selected['find-links'] = table['find-links'].map((value) => normalizeIndexLocation(repositoryRoot, value));
    const indexes = (table.index ?? []).map((index) => ({
        ...index,
        url: normalizeIndexLocation(repositoryRoot, index.url),
    }));
    if (table.index !== undefined) selected['index'] = indexes;
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const settingValues =
            key === 'index'
                ? indexes.map((index) => index.url)
                : values.filter((element) => typeof element === 'string');
        return settingValues.filter((value) => HTTP_URL.test(value)).flatMap((value) => extractUrlPasswords(value));
    });
    return { settings: selected, credentials };
}
