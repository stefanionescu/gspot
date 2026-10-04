/** Malformed manifest shapes that must become parse findings instead of engine failures. */
export const INVALID_WEB_MANIFESTS = ['null', '{"icons": "icon.png"}', '{"icons": [{"src": 42}]}'];
