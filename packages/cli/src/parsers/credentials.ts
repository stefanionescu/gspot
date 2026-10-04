/**
 * Read both encoded and decoded passwords from a registry or proxy URL.
 * @param source the authored URL
 * @returns password representations excluded from generated locks and diagnostics
 */
export function registryPasswords(source: string): string[] {
    const password = new URL(source).password;
    if (password.length === 0) return [];
    return [password, decodeURIComponent(password)];
}
