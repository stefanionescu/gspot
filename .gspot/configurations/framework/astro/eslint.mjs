import { root, stripRuntimeGlobals } from "../../language/javascript/eslint/functions.mjs";
import globals from "globals";
import tseslint from "typescript-eslint";
import astroPlugin from "eslint-plugin-astro";
export default [
    // astro: astroPlugin["configs"]["flat/recommended"][0].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][0],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][0].rules
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/recommended"][1].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][1],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][1].rules
        },
        files: [
            [
                "*.astro",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/recommended"][2].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][2],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][2].rules
        },
        files: [
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ],
            [
                "*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/recommended"][3].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][3],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][3].rules
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "*.astro/*.ts",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/recommended"][4].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][4],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][4].rules,
            "astro/missing-client-only-directive-value": [
                "error"
            ],
            "astro/no-conflict-set-directives": [
                "error"
            ],
            "astro/no-deprecated-astro-canonicalurl": [
                "error"
            ],
            "astro/no-deprecated-astro-fetchcontent": [
                "error"
            ],
            "astro/no-deprecated-astro-resolve": [
                "error"
            ],
            "astro/no-deprecated-getentrybyslug": [
                "error"
            ],
            "astro/no-unused-define-vars-in-style": [
                "error"
            ],
            "astro/valid-compile": [
                "error"
            ]
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][0].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][0],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][0].rules
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][1].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][1],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][1].rules
        },
        files: [
            [
                "*.astro",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][2].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2].rules
        },
        files: [
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ],
            [
                "*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][3].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3].rules
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "*.astro/*.ts",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][4].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4].rules,
            "astro/jsx-a11y/alt-text": [
                "error"
            ],
            "astro/jsx-a11y/anchor-has-content": [
                "error"
            ],
            "astro/jsx-a11y/anchor-is-valid": [
                "error"
            ],
            "astro/jsx-a11y/aria-activedescendant-has-tabindex": [
                "error"
            ],
            "astro/jsx-a11y/aria-props": [
                "error"
            ],
            "astro/jsx-a11y/aria-proptypes": [
                "error"
            ],
            "astro/jsx-a11y/aria-role": [
                "error"
            ],
            "astro/jsx-a11y/aria-unsupported-elements": [
                "error"
            ],
            "astro/jsx-a11y/autocomplete-valid": [
                "error"
            ],
            "astro/jsx-a11y/click-events-have-key-events": [
                "error"
            ],
            "astro/jsx-a11y/control-has-associated-label": "off",
            "astro/jsx-a11y/heading-has-content": [
                "error"
            ],
            "astro/jsx-a11y/html-has-lang": [
                "error"
            ],
            "astro/jsx-a11y/iframe-has-title": [
                "error"
            ],
            "astro/jsx-a11y/img-redundant-alt": [
                "error"
            ],
            "astro/jsx-a11y/label-has-associated-control": [
                "error"
            ],
            "astro/jsx-a11y/media-has-caption": [
                "error"
            ],
            "astro/jsx-a11y/mouse-events-have-key-events": [
                "error"
            ],
            "astro/jsx-a11y/no-access-key": [
                "error"
            ],
            "astro/jsx-a11y/no-autofocus": [
                "error"
            ],
            "astro/jsx-a11y/no-distracting-elements": [
                "error"
            ],
            "astro/jsx-a11y/no-noninteractive-tabindex": [
                "error",
                {
                    "tags": [],
                    "roles": [
                        "tabpanel",
                        "region"
                    ],
                    "allowExpressionValues": true
                }
            ],
            "astro/jsx-a11y/no-redundant-roles": [
                "error"
            ],
            "astro/jsx-a11y/role-has-required-aria-props": [
                "error"
            ],
            "astro/jsx-a11y/role-supports-aria-props": [
                "error"
            ],
            "astro/jsx-a11y/scope": [
                "error"
            ],
            "astro/jsx-a11y/tabindex-no-positive": [
                "error"
            ]
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro
    stripRuntimeGlobals({
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: root
            }
        },
        "ignores": [],
        rules: {
            "astro/no-set-html-directive": "error",
            "astro/no-exports-from-components": "error",
            "astro/no-prerender-export-outside-pages": "error",
            "astro/no-unused-css-selector": "error",
            "astro/prefer-class-list-directive": "error",
            "astro/prefer-object-class-list": "error",
            "astro/prefer-split-class-list": "error"
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro
    stripRuntimeGlobals({
        processor: 'astro/client-side-ts',
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                projectService: false,
                project: true
            }
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-unsafe-return": "off"
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // astro: { ...tseslint["configs"]["disableTypeChecked"].rules }
    stripRuntimeGlobals({
        ...tseslint["configs"]["disableTypeChecked"],
        "ignores": [],
        rules: {
            ...{
                ...tseslint["configs"]["disableTypeChecked"].rules
            }
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),
];
