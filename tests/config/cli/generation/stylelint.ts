import { TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';

/** Scope boundaries that include CSS owners and packages with no applicable CSS check. */
export const STYLELINT_SCOPES = '[scope."app"]\n[scope."app/child"]\n[scope."other"]\n';

/** Shared authored files that must survive managed native configuration changes. */
export const STYLELINT_PROJECT = {
    'package.json': TAKEOVER_PACKAGE,
    'source.css': 'a { opacity: 1; }\n',
    'app/package.json': TAKEOVER_PACKAGE,
    'app/source.css': 'a { opacity: 1; }\n',
    'app/child/package.json': TAKEOVER_PACKAGE,
    'other/package.json': TAKEOVER_PACKAGE,
    'plain/package.json': '{"private":true}\n',
};

/** Unowned shared sections remain reviewable without suggesting deletion of their packages. */
export const STYLELINT_SUGGESTIONS = [
    {
        path: 'app/child/package.json',
        command: 'move any stylelint setting you still need into gspot.toml, then delete the section',
    },
    {
        path: 'other/package.json',
        command: 'move any stylelint setting you still need into gspot.toml, then delete the section',
    },
];
