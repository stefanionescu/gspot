/** Authored package data whose Stylelint field hides the generated pointer. */
export const TAKEOVER_PACKAGE =
    '{\n  "name": "native-project",\n  "private": true,\n  "type": "module",\n  "stylelint": {"rules":{"property-no-unknown":null}}\n}\n';

/** A property the native Stylelint owner must reject at both levels. */
export const INVALID_CSS = 'a {\n    invalid-property: 1;\n}\n';
export const VALID_CSS = 'a {\n    opacity: 1;\n}\n';
