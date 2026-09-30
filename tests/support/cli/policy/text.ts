// The policy text a sandbox starts from: version 1, the kits, and whatever tables a test adds.

/**
 * A policy text with the kits selected, the level when given, and the tables that follow.
 * @param kits the kits the policy selects
 * @param extra the tables after the header, already in TOML
 * @param level the level line, when the test sets one
 * @returns the text of gspot.toml
 */
export function policyOf(kits: string[], extra = '', level?: string): string {
    const selected = kits.map((kit) => JSON.stringify(kit)).join(', ');
    const chosen = level === undefined ? '' : `level = "${level}"\n`;
    return `version = 1\n${chosen}kits = [${selected}]\n${extra}`;
}
