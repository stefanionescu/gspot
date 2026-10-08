import type { Manifest } from '#cli/types/configurations.ts';
import { CONFIGURATION_LABELS } from '#cli/config/configurations.ts';
import type { RuleFile, AgentRules, InstructionInputs } from '#cli/types/agent-rules.ts';
import { FIRST_READ, LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/policy/settings.ts';
import { RULES_ALONE, CHECKS_INSTALLED, INSTRUCTION_HEADING } from '#cli/config/agent-rules.ts';

function rulesByArea(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        // configurationFiles prefixes every rule path with its validated manifest kind.
        const category = file.path.split('/', 1)[0] as Manifest['configuration']['kind'];
        const area = CONFIGURATION_LABELS[category];
        const list = rows.get(area) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(area, list);
    }
    return [...rows];
}

function indexLines(rules: AgentRules, files: RuleFile[]): string[] {
    const { folder, own_rules_folder: local } = rules;
    const projectRow: [string, string[]][] = local === undefined ? [] : [['Project rules', [`\`${local}/\``]]];
    return [
        `Read ${FIRST_READ.map((path) => '`' + folder + '/' + path + '`').join(' and ')} first. Then read the rules for the files you change. A more specific rule wins over a general one.`,
        '',
        ...[...rulesByArea(files), ...projectRow].flatMap(([area, paths]) => [
            `${area}:`,
            '',
            ...paths.map((path) => `- ${path}`),
            '',
        ]),
    ];
}

/**
 * The managed instruction block for the already selected rules and enforcement level.
 * @param inputs the effective policy, selected rules, and presence of executable checks.
 * @param inputs.rules the authored rule-installation settings.
 * @param inputs.files the selected files with final content.
 * @param inputs.level the enforcement level.
 * @param inputs.hasChecks whether the selected configurations provide executable checks.
 * @returns the heading, rule index, and instructions for changing policy.
 */
export function managedBlock({ rules, files, level, hasChecks }: InstructionInputs): string {
    const index = files.length > 0 ? indexLines(rules, files) : [];
    const closing = hasChecks ? CHECKS_INSTALLED : RULES_ALONE;
    return [
        INSTRUCTION_HEADING,
        '',
        `Selected level: \`${level}\`. ${LEVEL_SUMMARY}`,
        '',
        ALL_LEVEL_SUMMARY,
        '',
        ...index,
        closing,
    ].join('\n');
}
