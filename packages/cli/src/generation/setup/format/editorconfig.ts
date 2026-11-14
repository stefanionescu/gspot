import { LINE_BREAK } from '#cli/config/system.ts';
import { findText } from '#cli/system/files/reads.ts';
import { DIGITS_ONLY } from '#cli/config/configurations/naming.ts';
import { prettierOptionsSchema } from '#cli/schemas/generation.ts';
import { EDITORCONFIG_FIXED_SECTIONS } from '#cli/config/configurations/general.ts';
import type { PrettierOptions, EditorconfigSection } from '#cli/types/generation.ts';
import { EDITORCONFIG_FILE, EDITORCONFIG_COMMENT, EDITORCONFIG_SECTION } from '#cli/config/generation/setup.ts';

function listLineSettings(files: string, fields: Record<string, string>): string[] {
    const sections: Readonly<Record<string, object>> = EDITORCONFIG_FIXED_SECTIONS;
    return Object.entries({ ...sections['*'], ...sections[files] })
        .filter(([key, value]) => fields[key] !== undefined && fields[key] !== String(value))
        .map(([key]) => key);
}

function parseEditorWidths(fields: Record<string, string>): Record<string, unknown> {
    const { max_line_length: lineWidth } = fields;
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const widths: Record<string, unknown> = {};
    if (width !== undefined && DIGITS_ONLY.test(width)) widths['tabWidth'] = Number(width);
    if (lineWidth === 'off') widths['printWidth'] = lineWidth;
    if (lineWidth !== undefined && DIGITS_ONLY.test(lineWidth)) widths['printWidth'] = Number(lineWidth);
    return widths;
}

function parseEditorSection(files: string, fields: Record<string, string>): PrettierOptions {
    const { indent_style: style, quote_type: quotes } = fields;
    const options = parseEditorWidths(fields);
    if (style === 'tab' || style === 'space') options['useTabs'] = style === 'tab';
    if (quotes === 'single' || quotes === 'double') options['singleQuote'] = quotes === 'single';
    const parsed = prettierOptionsSchema.parse(options);
    return { ...parsed, dropped: [...parsed.dropped, ...listLineSettings(files, fields)] };
}

function parseEditorconfigSections(text: string): EditorconfigSection[] {
    const sections: EditorconfigSection[] = [];
    let fields: Record<string, string> | undefined;
    for (const line of text.split(LINE_BREAK)) {
        if (EDITORCONFIG_COMMENT.test(line)) continue;
        const section = EDITORCONFIG_SECTION.exec(line);
        if (section !== null) {
            const files = section[1] as string;
            fields = {};
            sections.push({ files, fields });
            continue;
        }
        const equal = line.indexOf('=');
        if (fields !== undefined && equal !== -1) fields[line.slice(0, equal).trim()] = line.slice(equal + 1).trim();
    }
    return sections;
}

export function readEditorconfig(folder: string): PrettierOptions | null {
    const text = findText(folder, EDITORCONFIG_FILE);
    if (text === undefined) return null;
    const sections = parseEditorconfigSections(text);
    const project = Object.fromEntries(
        sections.filter(({ files }) => files === '*').flatMap(({ fields }) => Object.entries(fields)),
    );
    return {
        ...parseEditorSection('*', project),
        overrides: sections
            .filter(({ files }) => files !== '*')
            .map(({ files, fields }) => ({ files, options: parseEditorSection(files, fields) })),
    };
}
