/** Normalize a Python distribution name for package identity comparisons. */
export function normalizedPythonPackage(name: string): string {
    return name.toLowerCase().replaceAll(/[._-]+/gu, '-');
}
