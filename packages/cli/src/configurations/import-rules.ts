import type { ImportRule } from '#cli/types/settings.ts';
import { OWN_FILES_ONLY } from '#cli/config/configurations/structure.ts';

export function listAllowedRules(rules: ImportRule[], index: number): string[] {
    const rule = rules[index] as ImportRule;
    return [rule.name, ...(rule.can_import ?? rules.slice(0, index).map(({ name }) => name))];
}

export function formatRefusedImport(allowed: string[], imported: string, owner: string): string {
    const [name, ...others] = allowed;
    // A rule name prints as the user wrote it. ESLint reads this text as a template, and an escape added here breaks
    // the one that keeps a brace of the name out of that template.
    const quoted = others.map((rule) => `"${rule}"`).join(', ');
    const reach = others.length === 0 ? OWN_FILES_ONLY : `its own files and ${quoted}`;
    return `Import rule "${String(name)}" may import ${reach}, not ${imported} from ${owner}". Move the code, move that rule above this one, or list the rules it may import in can_import.`;
}
