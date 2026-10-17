import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';

/** Script URLs, plain and encoded, with the column of each finding. */
export const ACTIVE_URLS = [
    { markup: '<a href="javascript:alert(1)">Link</a>', column: 4 },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', column: 4 },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', column: 4 },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', column: 4 },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', column: 4 },
    { markup: '<iframe src="data:text/html,example"></iframe>', column: 9 },
    { markup: '<object data="data:image/svg+xml,example"></object>', column: 9 },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', column: 9 },
] as const;

/** Scheme text in places that do not run it, with no finding. */
export const INERT_MARKUP = [
    '<a href="/page">Link</a><script src="/app.js"></script>',
    '<a href="/page" title="javascript: is a scheme">Link</a>',
    '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">',
    '<img src="data:image/svg+xml,example" alt="Image">',
    '<a href="data:text/plain,example" download>Download</a>',
    '<script type="application/ld+json">{"name":"example"}</script>',
] as const;

/** A page with two autoplay findings at the same places in source and built output. */
export const AUTOPLAY_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" autoplay controls></audio>
<video src="movie.mp4" autoplay controls></video>
</main>
</body>
</html>
`;

/** The fix gives the visitor control of playback. */
export const CONTROLLED_PLAYBACK_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" controls></audio>
<video src="movie.mp4" controls></video>
</main>
</body>
</html>
`;

/** The app scope builds its own page; the root scope still checks its source HTML. */
export const AUTOPLAY_SCOPE_SETTINGS = `[[scope]]\npath = "app"\nconfigurations = ["site"]\n[scope.site]\nbuild_command = ["node", "build.mjs"]\n`;

/** Each command runs one HTML Validate check and leaves the other source file unchanged. */
export const AUTOPLAY_CHECKS = [
    {
        check: 'html/html-validate',
        scope: '',
        arguments: ['check', 'index.html', '--json', '--only', 'html/html-validate'],
        source: 'index.html',
        preserved: 'app/page.html',
        configuration: '.gspot/config/html-validate-source.json',
        findings: [
            { file: 'index.html', line: 7, column: 24, rule: 'no-autoplay' },
            { file: 'index.html', line: 8, column: 24, rule: 'no-autoplay' },
        ],
    },
    {
        check: 'site/html-validate',
        scope: 'app',
        arguments: ['check', 'app', '--json', '--only', 'site/html-validate'],
        source: 'app/page.html',
        preserved: 'index.html',
        configuration: '.gspot/config/app/html-validate-built.json',
        findings: [
            { file: 'app/dist/index.html', line: 7, rule: 'no-autoplay' },
            { file: 'app/dist/index.html', line: 8, rule: 'no-autoplay' },
        ],
    },
] as const;

export const CHECKS_HTML_INSTALLED_SANDBOX = {
    configurations: ['html', 'site'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
