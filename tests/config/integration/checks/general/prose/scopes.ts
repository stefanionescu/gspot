export const PACKAGE_STYLE_CASES = [
    { sample: 'Released July first.', findings: [[1, 'gspot.date-ordinals']] },
    { sample: 'Select a glyph.', findings: [[3, 'gspot.jargon']] },
    { sample: 'Firstly, run this command.', findings: [[5, 'gspot.ordinal-adverbs']] },
    { sample: 'Use ten percent of it.', findings: [[7, 'gspot.percentage-numbers']] },
    { sample: 'Run from 1 AM-2 PM.', findings: [[9, 'gspot.time-ranges']] },
    { sample: 'Use first- and second-order functions.', findings: [[11, 'gspot.suspended-hyphens']] },
    { sample: 'Use the URL for this resource.', findings: [[13, 'gspot.url-prepositions']] },
    { sample: 'Use five meters.', findings: [[15, 'gspot.numbered-units']] },
    { sample: 'And run this command.', findings: [[17, 'gspot.leading-conjunctions']] },
    { sample: 'Use the blacklist.', findings: [[19, 'gspot.conscious-language']] },
    { sample: "You can't run this command.", findings: [[21, 'gspot.contractions']] },
    { sample: '## API.', findings: [[23, 'gspot.punctuated-headings']] },
    { sample: 'Use the Name field.', findings: [[25, 'gspot.obvious-fields']] },
    { sample: 'The tool allows you to work.', findings: [[27, 'gspot.product-centric-writing']] },
    { sample: 'Use resource?sessionId=12345678.', findings: [[29, 'gspot.session-identifiers']] },
    {
        sample: 'Use \u{2018}native\u{2019} text.',
        findings: [
            [31, 'gspot.straight-quotes'],
            [31, 'gspot.straight-quotes'],
        ],
    },
    {
        sample: `${'<'.repeat(7)} HEAD
One native branch.
${'='.repeat(7)}
The other native branch.
${'>'.repeat(7)} native`,
        findings: [
            [33, 'gspot.title-case'],
            [33, 'gspot.merge-conflict-markers'],
            [33, 'gspot.acronyms'],
            [34, 'Google.HeadingPunctuation'],
            [35, 'gspot.merge-conflict-markers'],
            [37, 'gspot.merge-conflict-markers'],
        ],
    },
] as const;
