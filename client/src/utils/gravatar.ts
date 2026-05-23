export function gravatarUrl(hash: string, size = 40): string {
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}
