import { selectRuleFiles } from '#cli/agents/assemble.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { Policy } from '#cli/policy/normalize.ts';

const AREA_BY_LAYER: Record<string, string> = {
    agent: 'How to work here',
    code: 'Code, everywhere',
    prose: 'Documentation',
    language: 'Languages',
    runtime: 'Runtimes',
    framework: 'Frameworks',
    library: 'Libraries',
    tool: 'Tools',
    platform: 'Platforms',
    database: 'Databases',
    shared: 'Shared',
    repository: 'Repository',
};

const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.';
const RULES_ALONE =
    'These files are installed copies. Change `[rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';

function guideGroups(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const list = rows.get(AREA_BY_LAYER[file.layer] ?? file.layer) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(AREA_BY_LAYER[file.layer] ?? file.layer, list);
    }
    return [...rows];
}

function indexLines(rules: Policy['rules'], files: RuleFile[]): string[] {
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
 * @param manifests the selected configurations
 * @returns the block: a heading, the guide index when rules are installed, and the standing instructions
 */
export function managedBlock(rules: Policy['rules'], manifests: Manifest[]): string {
    const files = selectRuleFiles(rules, manifests);
    const index = files.length > 0 ? indexLines(rules, files) : [];
    const hasChecks = manifests.some((manifest) => manifest.checks.length > 0);
    const closing = hasChecks ? CHECKS_INSTALLED : RULES_ALONE;
    return ['# Engineering Guidelines', '', ...index, closing].join('\n');
}

/**
 * Select configured agent files and conventional integrations present in the repository.
 * @param root the repository root
 * @param configured additional instruction files selected by policy
 * @returns deduplicated repository-relative destinations
 */
export function agentFiles(root: string, configured: string[] = []): string[] {
    const files = openConfinedRoot(root);
    const detected = ['CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'].filter(
        (path) => files.read(path) !== undefined,
    );
    if (files.stat('.cursor')?.isDirectory() === true) detected.push('.cursor/rules/gspot.mdc');
    return [...new Set(['AGENTS.md', ...detected, ...configured])];
}

export type RuleFile = { source: string; target: string; layer: string; configuration: string; title: string };
