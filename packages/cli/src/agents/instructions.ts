import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { Session } from '#cli/types/execution.ts';
import type { RuleFile } from '#cli/types/agents.ts';
import { selectRuleFiles } from '#cli/agents/assemble.ts';

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

function areaFor(file: RuleFile): string {
    return AREA_BY_LAYER[file.layer] ?? file.layer;
}

function guideGroups(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const list = rows.get(areaFor(file)) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(areaFor(file), list);
    }
    return [...rows];
}

function indexLines(session: Session, files: RuleFile[]): string[] {
    const { directory, project } = session.policyFiles.policy.rules;
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
        '',
    ];
}

/**
 * The managed block text for a session.
 * @param session the session
 * @returns the block: a heading, the guide index when rules are installed, and the standing instructions
 */
export function managedBlock(session: Session): string {
    const files = selectRuleFiles(session);
    const index = files.length > 0 ? indexLines(session, files) : [];
    const hasChecks = session.scopes.some((scope) => scope.selected.some((manifest) => manifest.checks.length > 0));
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
