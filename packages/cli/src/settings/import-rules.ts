import type { ImportRule } from '#cli/types/settings/imports.ts';

/**
 * List the import rules whose files the files of one rule may import: the rule itself, and either its can_import list
 * or every rule above it with its can_also_import list.
 * @param rules every [[import_rule]] record, in order.
 * @param index the position of the importing rule.
 * @returns the allowed rule names, the importing rule first.
 */
export function listAllowedRules(rules: ImportRule[], index: number): string[] {
    const rule = rules[index] as ImportRule;
    const others = rule.can_import ?? [...rules.slice(0, index).map(({ name }) => name), ...rule.can_also_import];
    return [rule.name, ...others.filter((name) => name !== rule.name)];
}

/**
 * Explain an import that an import rule refuses.
 * @param allowed the names from listAllowedRules, the importing rule first.
 * @param imported the import as written.
 * @param owner the import rule of the imported file, as its category, such as import-rule:core.
 * @returns the finding message.
 */
export function formatRefusedImport(allowed: string[], imported: string, owner: string): string {
    const [name, ...others] = allowed;
    const quoted = others.map((rule) => JSON.stringify(rule)).join(', ');
    const reach = others.length === 0 ? 'only its own files' : `its own files and ${quoted}`;
    return `Import rule "${String(name)}" may import ${reach}, not ${imported} from ${owner}. Move the code, or add that rule to can_also_import or can_import.`;
}
