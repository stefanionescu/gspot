import type { SvgSavingCase } from '#tests/types/cli/checks/site.ts';
/** Malformed manifest shapes that must become parse findings instead of built-in check failures. */
export const INVALID_WEB_MANIFESTS = ['null', '{"icons": "icon.png"}', '{"icons": [{"src": 42}]}'];

/** A 100-byte SVG with multibyte content distinguishes byte savings from character savings. */
export const ORIGINAL_SVG =
    '<svg><!--éééééééééé--></svg>                                                              ';

export const SVG_SAVING_CASES: SvgSavingCase[] = [
    { name: 'recommended accepts the exact ten-percent boundary', level: 'recommended', saved: 10, finding: false },
    { name: 'recommended reports eleven-percent UTF-8 savings', level: 'recommended', saved: 11, finding: true },
    { name: 'all reports any byte reduction by default', level: 'all', saved: 1, finding: true },
    { name: 'an authored twenty-percent ceiling overrides all', level: 'all', percent: 20, saved: 11, finding: false },
    {
        name: 'an authored zero ceiling tightens recommended',
        level: 'recommended',
        percent: 0,
        saved: 1,
        finding: true,
    },
    {
        name: 'an authored twenty-percent ceiling reports larger savings',
        level: 'recommended',
        percent: 20,
        saved: 21,
        finding: true,
    },
];

/** Actual markup references and inert text that must not select arbitrary JSON. */
export const MANIFEST_LINKS =
    '<!-- <link rel="manifest" href="config/manifest.json"> -->\n<script>const text = \'<link rel="manifest" href="config/manifest.json">\';</script>\n<link HREF="metadata/app%20manifest.json?version=1&amp;other=2#entry" REL="alternate manifest">\n<link rel="manifest" href="https://example.com/config/manifest.json">\n';
