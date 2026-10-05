import type { SvgSavingCase } from '#tests/types/cli/checks/general/site.ts';
/** Malformed manifest shapes that must become parse findings instead of engine failures. */
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
