import { readFileSync } from 'node:fs';
import type { ReferencePage } from '#docs/types/pages.ts';
import { TABLE_HEADING_LEVEL } from '#docs/config/reference.ts';
import { formatText, buildReferencePage } from '#docs/reference/markdown.ts';

const CHANGELOG_TITLE = '# Changelog\n';

const CHANGE_LINE = /^- (?<subject>.+)$/u;

/**
Build the Changelog page from CHANGELOG.md when the site builds, so each new section shows on the next build. The page
starts after the title of the file, which leaves out the comment above it and a second page title. Each change is a
commit subject, so the page shows it as written: a word such as `<path>` stays text instead of becoming an HTML tag.
Its table of contents lists the releases.
*/
export function buildChangelogPage(): ReferencePage {
    const changelog = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
    const start = changelog.indexOf(CHANGELOG_TITLE);
    if (start === -1) throw new Error(`CHANGELOG.md has no title line ${CHANGELOG_TITLE.trim()}.`);
    const body = changelog
        .slice(start + CHANGELOG_TITLE.length)
        .trim()
        .split('\n')
        .map((line) => {
            const subject = CHANGE_LINE.exec(line)?.groups?.['subject'];
            return subject === undefined ? line : `- ${formatText(subject)}`;
        })
        .join('\n');
    const page = buildReferencePage(
        'Changelog',
        'The features, fixes, and performance changes of each gspot CLI release.',
        body,
    );
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}
