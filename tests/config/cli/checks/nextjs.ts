/** The translations settings naming the message directory and base locale. */
export const NEXT_TRANSLATIONS = '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n';

export const ROUTE =
    '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n';

export const MANIFEST =
    '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"next":"16.3.5","next-intl":"4.3.9","react":"19.1.1","react-dom":"19.1.1"}}\n';
