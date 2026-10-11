import { TargetContext } from '@/types/audit';
import ipaddr from 'ipaddr.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and normalizes user-provided URLs while strictly preserving pathnames,
 * query parameters, and protecting against SSRF & private network access.
 */
export function validateAndNormalizeUrl(rawInput: string): TargetContext {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new ValidationError('Enter a valid public webpage URL, such as example.com/pricing.');
  }

  let trimmed = rawInput.trim();

  // If scheme is omitted, default to https://
  if (!/^https?:\/\//i.test(trimmed)) {
    // Check if user accidentally provided unsupported protocol like file:// or ftp://
    if (/^[a-zA-Z0-9+-.]+:\/\//i.test(trimmed)) {
      throw new ValidationError('Only HTTP and HTTPS webpage URLs are supported.');
    }
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError('Enter a valid public webpage URL, such as example.com/pricing.');
  }

  // Enforce http/https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only HTTP and HTTPS webpage URLs are supported.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject empty hostnames or localhost aliases
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new ValidationError('Access to private or local network hosts is restricted.');
  }

  // Check IP addresses against SSRF private ranges
  if (ipaddr.isValid(hostname)) {
    const addr = ipaddr.parse(hostname);
    const range = addr.range();
    if (
      range === 'loopback' ||
      range === 'private' ||
      range === 'linkLocal' ||
      range === 'broadcast' ||
      range === 'carrierGradeNat' ||
      range === 'uniqueLocal'
    ) {
      throw new ValidationError('Access to private or local network IP addresses is restricted.');
    }
  }

  const isRootDomain = parsed.pathname === '/' || parsed.pathname === '';
  const normalizedUrl = parsed.toString();

  return {
    originalInput: rawInput,
    normalizedUrl,
    protocol: parsed.protocol as 'http:' | 'https:',
    hostname: parsed.hostname,
    pathname: parsed.pathname || '/',
    searchParams: parsed.search,
    isRootDomain,
  };
}
