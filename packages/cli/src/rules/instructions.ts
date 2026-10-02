import type { Manifest } from '#cli/types/kits.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import type { Level, RuleFile, RuleSettings } from '#cli/types/rules.ts';
import { RULES_ALONE, AREA_BY_LAYER, CHECKS_INSTALLED } from '#cli/config/rules.ts';

function guideGroups(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const list = rows.get(AREA_BY_LAYER[file.layer] ?? file.layer) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(AREA_BY_LAYER[file.layer] ?? file.layer, list);
    }
    return [...rows];
}

function indexLines(rules: RuleSettings, files: RuleFile[]): string[] {
    const { directory, project } = rules;
    const projectRow: [string, string[]][] =
        project === undefined || project === '' ? [] : [['Project rules', [`\`${project}/\``]]];
    return [
        `Read \`${directory}/agent/WORKING.md\` and \`${directory}/prose/WRITING.md\` first. Then read the guides for the files you change. A more specific layer wins over a general one.`,
        '',
        ...[...guideGroups(files), ...projectRow].flatMap(([area, guides]) => [
            `${area}:`,
            '',
            ...guides.map((guide) => `- ${guide}`),
            '',
        ]),
    ];
}

/**
 * The managed block text for a session.
 * @param rules the rule policy
 * @param manifests the selected kits.
 * @param level the selected enforcement level.
 * @param repository the source inventory for conditional guide selection.
 * @returns the block: a heading, the guide index when rules are installed, and the standing instructions
 */
export function managedBlock(rules: RuleSettings, manifests: Manifest[], level: Level, repository: Repository): string {
    const files = selectRuleFiles(rules, manifests, repository);
    const index = files.length > 0 ? indexLines(rules, files) : [];
    const hasChecks = manifests.some((manifest) => manifest.checks.length > 0);
    const closing = hasChecks ? CHECKS_INSTALLED : RULES_ALONE;
    return [
        '# Engineering Guidelines',
        '',
        `Selected level: \`${level}\`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.`,
        '',
        'Guide requirements about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.',
        '',
        ...index,
        closing,
    ].join('\n');
}
