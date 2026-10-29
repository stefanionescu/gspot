export const NESTJS_RULES = {
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
} as const;

export const NESTJS_INJECTABLE_FILTER_PATHS = [
    '/dist/',
    '/node_modules/',
    String.raw`\.test\.`,
    String.raw`\.spec\.`,
] as const;

export const SWAGGER_PACKAGE = '@nestjs/swagger';

export const TS_PATTERN = '**/*.ts';
