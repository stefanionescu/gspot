/** Each forbidden path must be refused independently in every authored directory table. */
export const UNSAFE_DIRECTORIES = [
    '../outside',
    '/outside',
    'C:outside',
    String.raw`..\outside`,
    String.raw`\\host\share`,
    'bad\0path',
    'api\n/../../outside',
    '',
];
