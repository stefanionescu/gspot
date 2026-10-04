/** Active URL schemes are decoded in executable resource contexts. */
export const ACTIVE_URLS = [
    { markup: '<a href="javascript:alert(1)">Link</a>', column: 4 },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', column: 4 },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', column: 4 },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', column: 4 },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', column: 4 },
    { markup: '<iframe src="data:text/html,example"></iframe>', column: 9 },
    { markup: '<object data="data:image/svg+xml,example"></object>', column: 9 },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', column: 9 },
];

/** The same scheme text remains inert outside an executable context. */
export const INERT_MARKUP = [
    '<a href="/page">Link</a><script src="/app.js"></script>',
    '<a href="/page" title="javascript: is a scheme">Link</a>',
    '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">',
    '<img src="data:image/svg+xml,example" alt="Image">',
    '<a href="data:text/plain,example" download>Download</a>',
    '<script type="application/ld+json">{"name":"example"}</script>',
];
