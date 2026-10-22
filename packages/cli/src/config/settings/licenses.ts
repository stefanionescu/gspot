/** An exact package version such as 2.0.0.post1, a version range such as ^1.2.0 or >=1 <2, or * for every version. */
export const ALLOWED_VERSION = /^(?:\*|\d[^\s@<>=~^*|,]*|[\d.xX*^~<>=|\s-]+)$/u;
