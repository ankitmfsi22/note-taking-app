export const REVOKE_MESSAGES = {
  notFound: 'This link no longer exists.',
  failed: 'Could not revoke the link. Please try again.',
} as const;

const MAX_DAYS = 365;
const DAY_MS = 86_400_000;

export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;

// The shared schema cannot check the range (it needs a clock); the server stays authoritative.
export const expiryRangeError = (expiry: Date): string | undefined => {
  const ahead = expiry.getTime() - Date.now();
  if (ahead <= 0) return 'Expiry must be in the future.';
  if (ahead > MAX_DAYS * DAY_MS) return `Expiry must be within ${MAX_DAYS} days.`;
  return undefined;
};
