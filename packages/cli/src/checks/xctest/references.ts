import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { xcodeFinding } from '#cli/checks/xcode/files.ts';

function escapePattern(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * Report references whose layout names no Swift test file in the same directory.
 * @param input the scoped files and snapshot layout
 * @returns the orphan reference findings
 */
export function referenceOwners(input: EngineInput): Finding[] {
    const layout = input.view.tool('xctest')['reference_layout'] as string;
    const pattern = layout
        .split(/(\{file\}|\{test\}|\*|\?)/u)
        .map((part) => {
            if (part === '{file}') return '(?<file>[^/]+)';
            if (part === '{test}') return '[^/]+';
            if (part === '*') return '[^/]*';
            if (part === '?') return '[^/]';
            return escapePattern(part);
        })
        .join('');
    const reference = new RegExp(`^(?<base>(?:[^/]+/)*)${pattern}$`, 'u');
    const owners = new Map<string, RegExp[]>();
    for (const file of input.files.filter((file) => file.tags.includes('swift-test'))) {
        const at = file.path.lastIndexOf('/') + 1;
        const base = file.path.slice(0, at);
        const name = file.path.slice(at, -'.swift'.length);
        const patterns = owners.get(base) ?? [];
        patterns.push(new RegExp(`^${pattern.replace('(?<file>[^/]+)', () => escapePattern(name))}$`, 'u'));
        owners.set(base, patterns);
    }
    return input.files.flatMap(({ path }): Finding[] => {
        const match = reference.exec(path);
        if (!match?.groups) return [];
        const base = match.groups['base'] ?? '';
        if (owners.get(base)?.some((owner) => owner.test(path.slice(base.length))) === true) return [];
        const owner = `${base}${match.groups['file'] ?? ''}.swift`;
        return [
            xcodeFinding(
                input,
                { file: path, line: 1 },
                'orphan-reference',
                `No test file ${owner} exists for this reference.`,
            ),
        ];
    });
}
