import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify } from '@decimalturn/toml-patch';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { PythonIndexSettings } from '#cli/types/tools.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { extractUrlPasswords } from '#cli/tools/installers/credentials.ts';
import { uvSettingsSchema, uvProjectSettingsSchema } from '#cli/schemas/tools.ts';
import { URL_SCHEME, INDEX_SETTINGS, UV_SETTINGS_FILE } from '#cli/config/tools/installers.ts';

export function writeUvSettings(folder: string, indexes: PythonIndexSettings['settings'], days: number): void {
    const settings = stringify({ ...indexes, 'exclude-newer': `${String(days)} days` });
    writeFileSync(join(folder, UV_SETTINGS_FILE), settings, { mode: PRIVATE_FILE });
}

export function readPythonSettings(root: string): PythonIndexSettings {
    const uv = findText(root, UV_SETTINGS_FILE);
    const project = findText(root, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (table['find-links'] !== undefined)
        selected['find-links'] = table['find-links'].map((value) =>
            URL_SCHEME.test(value) ? value : resolve(root, value),
        );
    const indexes = (table.index ?? []).map((index) => ({
        ...index,
        url: URL_SCHEME.test(index.url) ? index.url : resolve(root, index.url),
    }));
    if (table.index !== undefined) selected['index'] = indexes;
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const settingValues =
            key === 'index'
                ? indexes.map((index) => index.url)
                : values.filter((element) => typeof element === 'string');
        return settingValues.flatMap((value) => extractUrlPasswords(value));
    });
    return { settings: selected, credentials };
}
