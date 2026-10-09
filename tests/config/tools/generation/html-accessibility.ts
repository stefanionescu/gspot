import type { HtmlAccessibilityCheck } from '#tests/types/tools/generation/html.ts';

/** Source markup and built output share the same two independently located media findings. */
export const HTML_ACCESSIBILITY_PAGE = `<!doctype html>
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
/** The explicit correction leaves playback under the visitor's control. */
export const HTML_ACCESSIBILITY_CORRECTED = `<!doctype html>
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
/** Each selected site builds its authored page without changing the root source owner. */
export const HTML_ACCESSIBILITY_SCOPES = `[scope."app"]
configurations = ["site"]
[scope.app.site]
build_command = ["node", "build.mjs"]
`;
/** Each public invocation selects one native reader and keeps its unrelated source unchanged. */
export const HTML_ACCESSIBILITY_CHECKS: HtmlAccessibilityCheck[] = [
    {
        check: 'html/validate',
        scope: '',
        arguments: ['check', 'index.html', '--json', '--only', 'html/validate'],
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
];
