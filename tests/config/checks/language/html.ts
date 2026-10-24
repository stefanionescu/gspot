export const URL_MARKUP_CASES = [
    { markup: '<a href="javascript:alert(1)">Link</a>', columns: [4] },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', columns: [4] },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', columns: [4] },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', columns: [4] },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', columns: [4] },
    { markup: '<iframe src="data:text/html,example"></iframe>', columns: [9] },
    { markup: '<object data="data:image/svg+xml,example"></object>', columns: [9] },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', columns: [9] },
    { markup: '<a href="/page">Link</a><script src="/app.js"></script>', columns: [] },
    { markup: '<a href="/page" title="javascript: is a scheme">Link</a>', columns: [] },
    { markup: '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">', columns: [] },
    { markup: '<img src="data:image/svg+xml,example" alt="Image">', columns: [] },
    { markup: '<a href="data:text/plain,example" download>Download</a>', columns: [] },
    { markup: '<script type="application/ld+json">{"name":"example"}</script>', columns: [] },
] as const;

export const INLINE_SCRIPT_PAGE = `<!doctype html>
<html lang="en">
<head><title>Shop</title></head>
<body>
<script>window.start();</script>
<button onclick="start()">Start</button>
<script type="application/json">{"name":"shop"}</script>
<script src="app.js"></script>
</body>
</html>
`;

export const SCRIPT_TYPE_CASES = [
    { type: 'text/x-template', rules: [] },
    { type: 'text/plain', rules: [] },
    { type: 'text/markdown', rules: [] },
    { type: 'x-shader/x-vertex', rules: [] },
    { type: '', rules: ['inline-script', 'script-link'] },
    { type: 'module', rules: ['inline-script', 'script-link'] },
    { type: ' Text/JavaScript ', rules: ['inline-script', 'script-link'] },
    { type: 'application/ecmascript', rules: ['inline-script', 'script-link'] },
] as const;
