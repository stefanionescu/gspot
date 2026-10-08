import { STATIC_SITE_FILES } from '#tests/config/samples/site.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const COMMAND = ['check', '--only', 'site/svgo', '--json'];

export const REPOSITORY: InstalledScenario = {
    configurations: ['site'],

    files: STATIC_SITE_FILES,
};

export const CASES: FindingCase[] = [
    {
        check: 'site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: { file: '', rule: 'build', line: 1 },
    },
];

export const ORPHAN_SITE_FILES = {
    'sitemap.xml': STATIC_SITE_FILES['sitemap.xml'],
    'orphan.html':
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#missing">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
};

export const USED_SELECTOR_BODY =
    '<p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script>';

export const USED_SELECTOR_CSS = String.raw`.print\:hidden { display: none; }.w-1\/2 { width: 50%; }.feedback.show { opacity: 1; }.pagefind-ui__result { color: blue; }.pagefind-ui__loading { opacity: 0.5; }.unused { color: red; }:focus-visible { outline: 3px solid blue; }.unused:focus-visible { color: red; }.reviewed:focus-visible { color: purple; }`;

export const REVIEWED_SELECTOR_POLICY =
    '\n[tools.purgecss.safelist]\nreviewed = "The script adds this reviewed class at runtime."\n';
