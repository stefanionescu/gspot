import { OWN_FILES_ONLY } from '#cli/config/configurations/structure.ts';
import type { ImportRule } from '#cli/types/settings.ts';

export function listAllowedRules(rules: ImportRule[], index: number): string[] {
    const rule = rules[index] as ImportRule;
    return [rule.name, ...(rule.can_import ?? rules.slice(0, index).map(({ name }) => name))];
}

export function formatRefusedImport(allowed: string[], imported: string, owner: string): string {
    const [name, ...others] = allowed;
    const quoted = others.map((rule) => JSON.stringify(rule)).join(', ');
    const reach = others.length === 0 ? OWN_FILES_ONLY : `its own files and ${quoted}`;
    return `Import rule "${String(name)}" may import ${reach}, not ${imported} from ${owner}". Move the code, move that rule above this one, or list the rules it may import in can_import.`;
}
