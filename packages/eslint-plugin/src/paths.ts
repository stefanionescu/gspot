/**
 * Turn backslashes into forward slashes, uppercase a Windows drive letter, and leave other characters unchanged.
 * @param value the file path
 * @returns the normalized path
 */
export function normalizePath(value: string): string {
    return value.replaceAll('\\', '/').replace(/^[a-z]:/u, (drive) => drive.toUpperCase());
}
