export const URL_MARKUP_CASES = [
    { markup: '<a href="javascript:alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', scheme: 'vbscript:', columns: [4] },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', scheme: 'data:', columns: [4] },
    { markup: '<iframe src="data:text/html,example"></iframe>', scheme: 'data:', columns: [9] },
    { markup: '<object data="data:image/svg+xml,example"></object>', scheme: 'data:', columns: [9] },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', scheme: 'data:', columns: [9] },
    { markup: '<a href="/page">Link</a><script src="/app.js"></script>', scheme: '', columns: [] },
    { markup: '<a href="/page" title="javascript: is a scheme">Link</a>', scheme: '', columns: [] },
    { markup: '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">', scheme: '', columns: [] },
    { markup: '<img src="data:image/svg+xml,example" alt="Image">', scheme: '', columns: [] },
    { markup: '<a href="data:text/plain,example" download>Download</a>', scheme: '', columns: [] },
    { markup: '<script type="application/ld+json">{"name":"example"}</script>', scheme: '', columns: [] },
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
    { type: 'text&#x2F;javascript', rules: ['inline-script', 'script-link'] },
    { type: 'text/plain', rules: [] },
    { type: '', rules: ['inline-script', 'script-link'] },
    { type: 'module', rules: ['inline-script', 'script-link'] },
    { type: ' Text/JavaScript ', rules: ['inline-script', 'script-link'] },
    { type: 'application/ecmascript', rules: ['inline-script', 'script-link'] },
] as const;
