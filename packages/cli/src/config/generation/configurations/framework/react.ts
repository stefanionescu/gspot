export const REACT_RULES = {
    '@eslint-react/no-missing-component-display-name': 'error',
    '@eslint-react/no-array-index-key': 'error',
    '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    '@eslint-react/no-nested-component-definitions': 'error',
    '@eslint-react/no-unstable-context-value': 'error',
    '@eslint-react/no-unstable-default-props': 'error',
} as const;

export const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;

export const REACT_DOM_RULE_OPTIONS = { 'jsx-a11y-x/no-noninteractive-tabindex': { roles: [...FOCUSABLE_ROLES] } };
