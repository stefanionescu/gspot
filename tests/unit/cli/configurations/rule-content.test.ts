import { posix } from 'node:path';
import { test, expect } from 'bun:test';
import { ALL_LEVEL_MARKER } from '#cli/config/rules.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readAsset, listAssets } from '#cli/system/assets.ts';
import { readManifests } from '#cli/configurations/manifests.ts';

type MarkdownNode = {
    type: string;
    position?: { start: { offset: number }; end: { offset: number } };
    children?: MarkdownNode[];
};
type RuleReferences = {
    checks: ReadonlySet<string>;
    commands: ReadonlySet<string>;
    settings: ReadonlyMap<string, unknown>;
};

/** Walk Markdown structure while leaving code examples as leaf nodes. */
function listRuleNodes(text: string): MarkdownNode[] {
    const nodes = [...fromMarkdown(text).children] as MarkdownNode[];
    for (const node of nodes) if (node.children !== undefined) nodes.push(...node.children);
    return nodes;
}

/** Collect Markdown headings without treating fenced examples as headings. */
function ruleHeadings(text: string): string[] {
    return listRuleNodes(text)
        .filter((node) => node.type === 'heading')
        .map((node) => text.slice(node.position!.start.offset, node.position!.end.offset));
}

/** A marked heading covers its child sections until the next heading of equal or lower depth. */
function listAllLevelRanges(text: string): { start: number; end: number }[] {
    const nodes = fromMarkdown(text).children;
    return nodes.flatMap((node, index) => {
        const marker = nodes[index + 1];
        if (node.type !== 'heading' || marker?.type !== 'html' || marker.value.trim() !== ALL_LEVEL_MARKER) return [];
        const following = nodes.slice(index + 1).find((next) => next.type === 'heading' && next.depth <= node.depth);
        return [{ start: node.position!.start.offset!, end: following?.position?.start.offset ?? text.length }];
    });
}

/** Report level prose outside the section ranges that recommended installations omit. */
function hasUnmarkedLevelText(text: string): boolean {
    const ranges = listAllLevelRanges(text);
    return listRuleNodes(text).some((node) => {
        if (node.type !== 'paragraph') return false;
        const offset = node.position!.start.offset;
        const prose = text.slice(offset, node.position!.end.offset);
        return (
            /At level (?:`?all`?|`?recommended`?)/u.test(prose) &&
            !ranges.some(({ start, end }) => start <= offset && offset < end)
        );
    });
}

/** Find check identifiers only where the prose explicitly calls them checks or findings. */
function listMentionedChecks(text: string): string[] {
    const prose = [...text.matchAll(/`([a-z][a-z-]+\/[a-z][a-z-]+)`/gu)]
        .filter(
            (match) =>
                /^\s+(?:checks?|finding|reports?|enforces?|finds?|runs?)\b/u.test(
                    text.slice(match.index + match[0].length),
                ) || /\b(?:check|finding)\s+$/u.test(text.slice(0, match.index)),
        )
        .map((match) => match[1]!);
    const commands = [...text.matchAll(/`gspot check\b[^`]*?--only\s+(?<check>[a-z][a-z-]+\/[a-z][a-z-]+)/gu)].map(
        (match) => match.groups!['check']!,
    );
    return [...prose, ...commands];
}

/** Check the rule opening, heading identity, and the preceding level marker. */
function ruleStructureViolations(path: string, text: string): string[] {
    const violations: string[] = [];
    const lines = text.split('\n');
    if (posix.basename(path) !== 'TALKING.md' && lines[2]?.startsWith('Read this rule') !== true)
        violations.push(`${path}: opening`);
    const headings = ruleHeadings(text);
    if (new Set(headings).size !== headings.length) violations.push(`${path}: repeated heading`);
    if (hasUnmarkedLevelText(text)) violations.push(`${path}: unmarked level`);
    return violations;
}

/** Validate only explicit command, check, and setting names against their shipped declarations. */
function ruleReferenceViolations(source: { path: string; text: string }, references: RuleReferences): string[] {
    const { path, text } = source;
    const commands = [...text.matchAll(/`gspot ([a-z-]+)(?:\s[^`]*)?`/gu)]
        .map((match) => match[1]!)
        .filter((name) => !references.commands.has(name))
        .map((name) => `${path}: command ${name}`);
    const checks = listMentionedChecks(text)
        .filter((name) => !references.checks.has(name))
        .map((name) => `${path}: check ${name}`);
    const roots = new Set([...references.settings.keys()].map((name) => name.split('.', 1)[0]));
    const settings = [...text.matchAll(/`([a-z_]+(?:\.[a-z_]+)+)`/gu)]
        .map((match) => match[1]!)
        .filter((name) => roots.has(name.split('.', 1)[0]) && !references.settings.has(name))
        .map((name) => `${path}: setting ${name}`);
    return [...commands, ...checks, ...settings];
}

test('shipped rules state when to read them and use declared names and distinct headings', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const references = {
        checks: new Set(manifests.flatMap((manifest) => manifest.checks.map(({ name }) => name))),
        settings: buildKnownSettings(manifests, 'all').declarations,
        commands: new Set(Object.keys(COMMAND_HELP)),
    };
    const violations: string[] = [];
    for (const manifest of manifests) {
        const paths = listAssets(`${manifest.folder}/rules/`).filter((file) => file.endsWith('.md'));
        for (const path of paths) {
            const text = readAsset(path);
            violations.push(
                ...ruleStructureViolations(path, text),
                ...ruleReferenceViolations({ path, text }, references),
            );
        }
    }
    expect(violations).toStrictEqual([]);
});
