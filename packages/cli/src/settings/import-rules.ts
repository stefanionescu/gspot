import { OWN_FILES_ONLY } from '#cli/config/settings/settings.ts';
import type { ImportRule } from '#cli/types/settings/settings.ts';

/**
List the import rules whose files the files of one rule may import: the rule itself, and either its can_import list
or every rule above it.

@param rules every [[import_rule]] record, in order.
@param index the position of the importing rule.
@returns the allowed rule names, the importing rule first.
*/
export function listAllowedRules(rules: ImportRule[], index: number): string[] {
    const rule = rules[index] as ImportRule;
    return [rule.name, ...(rule.can_import ?? rules.slice(0, index).map(({ name }) => name))];
}

/**
Explain an import that an import rule refuses.

@param allowed the names from listAllowedRules, the importing rule first.
@param imported the import as written.
@param owner the import rule of the imported file, as its category, such as import-rule:core.
*/
export function formatRefusedImport(allowed: string[], imported: string, owner: string): string {
    const [name, ...others] = allowed;
    const quoted = others.map((rule) => JSON.stringify(rule)).join(', ');
    const reach = others.length === 0 ? OWN_FILES_ONLY : `its own files and ${quoted}`;
    return `Import rule "${String(name)}" may import ${reach}, not ${imported} from ${owner}. Move the code, move that rule above this one, or list the rules it may import in can_import.`;
}
