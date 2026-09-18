// The index block for CLAUDE.md and AGENTS.md.
import type { Session } from '#cli/run/session.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import type { RuleFile } from '#cli/rules/assemble.ts';

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

function areaFor(file: RuleFile): string {
    const base = AREA_BY_LAYER[file.layer] ?? file.layer;
    if (
        file.layer === 'language' ||
        file.layer === 'framework' ||
        file.layer === 'library' ||
        file.layer === 'tool' ||
        file.layer === 'platform' ||
        file.layer === 'database' ||
        file.layer === 'runtime'
    ) {
        return file.title || `${base}: ${file.preset}`;
    }
    return base;
}

/** The managed block text for a session. */
export function managedBlock(session: Session): string {
    const directory = session.loaded.policy.rules.directory;
    const files = selectRuleFiles(session);
    const rows = new Map<string, string[]>();
    for (const file of files) {
        const area = areaFor(file);
        const list = rows.get(area) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(area, list);
    }
    const lines = ['# Engineering guidelines', ''];
    if (files.length > 0) {
        lines.push(
            `Read \`${directory}/general/agent/WORKING.md\` and \`${directory}/general/prose/WRITING.md\` first. Then read the guides for the files you change. A more specific layer wins over a general one.`,
            '',
            '| Area | Guide |',
            '| --- | --- |',
        );
        for (const [area, list] of rows) lines.push(`| ${area} | ${list.join(', ')} |`);
        if (session.loaded.policy.rules.project)
            lines.push(`| Project rules | \`${session.loaded.policy.rules.project}/\` |`);
        lines.push('');
    }
    lines.push(
        'Run `gspot check --staged` before committing. Change policy with `gspot set`, `gspot allow` or `gspot ignore` (or by editing `gspot.toml`), then `gspot sync`; never edit files under `.gspot/`. Do not use subagents or parallel agents unless asked in the conversation.',
    );
    return lines.join('\n');
}
