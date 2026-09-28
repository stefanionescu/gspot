import type { Manifest } from '#cli/types/kits.ts';
import type { RuleFile } from '#cli/types/agents.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { selectRuleFiles } from '#cli/agents/assemble.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { RULES_ALONE, AREA_BY_LAYER, CHECKS_INSTALLED } from '#cli/config/agents.ts';

function guideGroups(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const list = rows.get(AREA_BY_LAYER[file.layer] ?? file.layer) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(AREA_BY_LAYER[file.layer] ?? file.layer, list);
    }
    return [...rows];
}

function indexLines(rules: Policy['guides'], files: RuleFile[]): string[] {
    const { directory, project } = rules;
    const projectRow: [string, string[]][] =
        project === undefined || project === '' ? [] : [['Project rules', [`\`${project}/\``]]];
    return [
        `Read \`${directory}/general/agent/WORKING.md\` and \`${directory}/general/prose/WRITING.md\` first. Then read the guides for the files you change. A more specific layer wins over a general one.`,
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
export function managedBlock(
    rules: Policy['guides'],
    manifests: Manifest[],
    level: Policy['level'],
    repository: Repository,
): string {
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

/**
 * Select configured agent files and conventional integrations present in the repository.
 * @param root the repository root
 * @param configured additional instruction files selected by policy
 * @returns deduplicated repository-relative destinations
 */
export function agentFiles(root: string, configured: string[] = []): string[] {
    const files = openRoot(root);
    const detected = ['CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'].filter(
        (path) => files.read(path) !== undefined,
    );
    if (files.stat('.cursor')?.isDirectory() === true) detected.push('.cursor/rules/gspot.mdc');
    return [...new Set(['AGENTS.md', ...detected, ...configured])];
}
