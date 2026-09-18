// The index block for the agent instruction files.
import type { Session } from '#types/run.ts';
import type { RuleFile } from '#types/rules.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';

const AREA_BY_LAYER: Record<string, string> = {
    agent: 'How to work here',
    code: 'Code, everywhere',
    prose: 'Writing and documentation',
    language: 'Language',
    runtime: 'Runtime',
    framework: 'Framework',
    library: 'Library',
    tool: 'Tool',
    platform: 'Platform',
    database: 'Database',
    shared: 'Shared',
    repository: 'Repository',
};

const MIN_COLUMN = 3;
const TITLED_LAYERS = new Set(['language', 'framework', 'library', 'tool', 'platform', 'database', 'runtime']);

const SUBAGENTS = 'Do not use subagents or parallel agents unless asked in the conversation.';
const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set`, `gspot allow` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.';
const RULES_ALONE =
    'These files are installed copies. Change `[rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';

function areaFor(file: RuleFile): string {
    const base = AREA_BY_LAYER[file.layer] ?? file.layer;
    if (!TITLED_LAYERS.has(file.layer)) return base;
    return file.title === '' ? `${base}: ${file.preset}` : file.title;
}

function tableRows(files: RuleFile[]): [string, string][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const list = rows.get(areaFor(file)) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(areaFor(file), list);
    }
    return rows
        .entries()
        .map(([area, list]): [string, string] => [area, list.join(', ')])
        .toArray();
}

function markdownTable(head: [string, string], rows: [string, string][]): string[] {
    const all = [head, ...rows];
    const widths = [0, 1].map((column) => Math.max(MIN_COLUMN, ...all.map((row) => row[column]?.length ?? 0)));
    const line = (row: [string, string]): string =>
        `| ${row[0].padEnd(widths[0] ?? 0)} | ${row[1].padEnd(widths[1] ?? 0)} |`;
    const separator = `| ${'-'.repeat(widths[0] ?? 0)} | ${'-'.repeat(widths[1] ?? 0)} |`;
    return [line(head), separator, ...rows.map((row) => line(row))];
}

function indexLines(session: Session, files: RuleFile[]): string[] {
    const { directory, project } = session.policyFiles.policy.rules;
    const projectRow: [string, string][] =
        project === undefined || project === '' ? [] : [['Project rules', `\`${project}/\``]];
    return [
        `Read \`${directory}/general/agent/WORKING.md\` and \`${directory}/general/prose/WRITING.md\` first. Then read the guides for the files you change. A more specific layer wins over a general one.`,
        '',
        ...markdownTable(['Area', 'Guide'], [...tableRows(files), ...projectRow]),
        '',
    ];
}

/**
 * The managed block text for a session.
 * @param session the session
 * @returns the block: a heading, the guide table when rules are installed, and the standing instructions
 */
export function managedBlock(session: Session): string {
    const files = selectRuleFiles(session);
    const index = files.length > 0 ? indexLines(session, files) : [];
    const hasChecks = session.scopes.some((scope) => scope.selected.some((manifest) => manifest.checks.length > 0));
    const closing = `${hasChecks ? CHECKS_INSTALLED : RULES_ALONE} ${SUBAGENTS}`;
    return ['# Engineering Guidelines', '', ...index, closing].join('\n');
}
