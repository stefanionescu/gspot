import type { RuleContext } from '../types/plugin.ts';
import { DRIVE_LETTER, PLUGIN_PREFIX, TRAILING_SLASH } from '../config/plugin.ts';

/**
Find where a path sits inside a folder. Both take either separator and any drive letter case.
The folder `.` holds every relative path that does not climb out of it.
*/
export function findPathInFolder(folder: string, path: string): string | undefined {
    const root = folder
        .replaceAll('\\', '/')
        .replace(DRIVE_LETTER, (drive) => drive.toUpperCase())
        .replace(TRAILING_SLASH, '');
    const file = path.replaceAll('\\', '/').replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
    if (file === root) return '';
    if (root === '.') return file === '..' || file.startsWith('../') ? undefined : file;
    return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : undefined;
}

/**
Get the root folder that the `gspot` setting names. A root that is not a string counts as unset.
*/
export function getRootFolder(context: Pick<RuleContext, 'settings'>): string | undefined {
    const setting = context.settings[PLUGIN_PREFIX];
    const root = setting !== null && typeof setting === 'object' && 'root' in setting ? setting.root : undefined;
    return typeof root === 'string' ? root : undefined;
}

/**
Find where the linted file sits inside the root that the `gspot` setting names, or inside the working folder.
*/
export function findPathInRoot(
    context: Pick<RuleContext, 'cwd' | 'physicalFilename' | 'settings'>,
): string | undefined {
    return findPathInFolder(getRootFolder(context) ?? context.cwd, context.physicalFilename);
}
