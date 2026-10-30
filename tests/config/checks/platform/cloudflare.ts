export const CLOUDFLARE_REDIRECTS = `/old /new 200
/old /new 301
/old /new 302
/old /new 303
/old /new 307
/old /new 308
/old /new
/old /new 404
/old /new 410
/old /new 302!
/lonely
old /new 301
`;

export const CLOUDFLARE_HEADERS = `  Header-before-path: value
# Comment
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  Content-Security-Policy: frame-ancestors none
/assets/*
  X-Frame-Options: INVALID
  No colon
assets/*
  X-Robots-Tag: noindex
`;

export const CLOUDFLARE_SCOPE_SETTINGS = [{ path: 'app', configurations: ['cloudflare'] }];

export const SECURITY_HEADER_CASES = [
    {
        name: 'missing content type protection',
        text: '/*\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n',
        missing: ['x-content-type-options'],
    },
    {
        name: 'missing referrer policy',
        text: '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n',
        missing: ['referrer-policy'],
    },
    {
        name: 'no global block',
        text: '/assets/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n',
        missing: ['x-content-type-options', 'referrer-policy', 'x-frame-options'],
    },
    {
        name: 'a detached unrelated header',
        text: '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  ! X-Powered-By\n',
        missing: [],
    },
] as const;
