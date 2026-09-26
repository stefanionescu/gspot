import type { FrontMatter, RuleFinding } from '#cli/types/agents.ts';
import { RULE_LAYERS, CONFIGURATION_ID, FENCE } from '#cli/constants/agents.ts';

const LAYERS = new Set(RULE_LAYERS);
function fieldsOf(lines: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    return fields;
}

/**
 * The layer a path implies: the second segment under general/, `template` under templates/, else the first segment.
 * @param path the file relative to rules/
 * @returns the layer
 */
export function layerOfPath(path: string): string {
    const segments = path.split('/');
    if (segments[0] === 'general') return segments[1] ?? '';
    if (segments[0] === 'templates') return 'template';
    return segments[0] ?? '';
}

/**
 * Parses the front matter between the opening and closing `---` lines.
 * @param text the file text
 * @returns the front matter, or undefined when the file has none
 */
export function parseFrontMatter(text: string): FrontMatter | undefined {
    const lines = text.split('\n');
    if (lines[0] !== FENCE) return undefined;
    const end = lines.indexOf(FENCE, 1);
    if (end === -1) return undefined;
    const fields = fieldsOf(lines.slice(1, end));
    return {
        layer: fields['layer'] ?? '',
        configuration: fields['configuration'] ?? '',
        title: fields['title'] ?? '',
        fields,
    };
}

/**
 * What is wrong with a file's front matter: missing, an unknown layer, a configuration that is not an id, a layer that does not match the path, a title that is not the H1.
 * @param path the file relative to rules/
 * @param text the file text
 * @returns the findings
 */
export function frontMatterFindings(path: string, text: string): RuleFinding[] {
    const matter = parseFrontMatter(text);
    if (matter === undefined) return [{ file: path, line: 1, message: 'missing front matter' }];
    const findings: RuleFinding[] = [];
    const expected = layerOfPath(path);
    if (!LAYERS.has(matter.layer)) findings.push({ file: path, line: 2, message: `unknown layer '${matter.layer}'` });
    else if (matter.layer !== expected)
        findings.push({
            file: path,
            line: 2,
            message: `layer '${matter.layer}' does not match the path ('${expected}')`,
        });
    if (!CONFIGURATION_ID.test(matter.configuration))
        findings.push({
            file: path,
            line: 3,
            message: `configuration '${matter.configuration}' is not a configuration id or none`,
        });
    const heading =
        text
            .split('\n')
            .find((line) => line.startsWith('# '))
            ?.slice(2) ?? '';
    if (heading !== matter.title)
        findings.push({ file: path, line: 4, message: `title '${matter.title}' does not equal the H1 '${heading}'` });
    return findings;
}
