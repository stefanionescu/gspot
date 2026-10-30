import { DRIVE_LETTER, TRAILING_SLASH } from './config/plugin.ts';

/**
Find where a path sits inside a folder. Both take either separator and any drive letter case.
The folder `.` holds every relative path that does not climb out of it.

@param folder the folder, absolute or relative
@param path the file or folder to place
@returns the POSIX path below the folder, empty for the folder itself, or undefined outside it
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
