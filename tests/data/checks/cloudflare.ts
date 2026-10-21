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
`;

export const CLOUDFLARE_SCOPE_SETTINGS = [{ path: 'app', configurations: ['cloudflare'] }];
