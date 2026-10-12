/**
 * Normalize path separators and Windows drive letters without changing path characters.
 * @param value the file path
 * @returns the path with forward slashes and an uppercase Windows drive letter
 */
export function normalizePath(value: string): string {
    return value.replaceAll('\\', '/').replace(/^[a-z]:/u, (drive) => drive.toUpperCase());
}
