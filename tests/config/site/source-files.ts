/** Malformed manifest shapes that must become parse findings instead of built-in check failures. */
export const INVALID_WEB_MANIFESTS = ['null', '{"icons": "icon.png"}', '{"icons": [{"src": 42}]}'] as const;

/** A 100-byte SVG with multibyte content distinguishes byte savings from character savings. */
export const ORIGINAL_SVG =
    '<svg><!--éééééééééé--></svg>                                                              ';

export const SVG_SAVING_CASES = [
    { name: 'the exact ten-percent boundary passes', percent: 10, saved: 10, finding: false },
    { name: 'a twenty-percent limit accepts smaller savings', percent: 20, saved: 11, finding: false },
    { name: 'a zero limit reports a byte reduction', percent: 0, saved: 1, finding: true },
    { name: 'a twenty-percent limit reports larger savings', percent: 20, saved: 21, finding: true },
] as const;

/** Actual markup references and inert text that must not select arbitrary JSON. */
export const MANIFEST_LINKS = `<!-- <link rel="manifest" href="config/manifest.json"> -->
<script>const text = '<link rel="manifest" href="config/manifest.json">';</script>
<link HREF="metadata/app%20manifest.json?version=1&amp;other=2#entry" REL="alternate manifest">
<link rel="manifest" href="https://example.com/config/manifest.json">
`;
