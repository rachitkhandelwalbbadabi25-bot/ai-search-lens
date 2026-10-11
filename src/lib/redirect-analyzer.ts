import { RedirectAnalysis, RedirectHop, RedirectKind } from '@/types/audit';
import { isLocaleSegment, isRootOrLocaleRoot } from './page-context';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AI-Search-Lens/1.0';

/**
 * Traces HTTP-level redirects hop by hop (redirect: 'manual') so that status codes,
 * chains and loops can be classified. Never throws — returns traceAvailable=false on failure.
 */
export async function traceRedirects(startUrl: string, maxHops = 10, timeoutMs = 8000): Promise<{
  hops: RedirectHop[];
  finalUrl: string;
  isLoop: boolean;
  traceAvailable: boolean;
}> {
  const hops: RedirectHop[] = [];
  const seen = new Set<string>();
  let current = startUrl;
  const deadline = Date.now() + timeoutMs;

  try {
    for (let i = 0; i < maxHops; i++) {
      const key = current.toLowerCase();
      if (seen.has(key)) {
        return { hops, finalUrl: current, isLoop: true, traceAvailable: true };
      }
      seen.add(key);

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
        signal: AbortSignal.timeout(Math.min(remaining, 6000)),
      });
      // Body not needed; release the socket.
      try { await res.body?.cancel(); } catch { /* ignore */ }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        hops.push({ url: current, status: res.status, location });
        if (!location) break;
        current = new URL(location, current).toString();
        continue;
      }
      return { hops, finalUrl: current, isLoop: false, traceAvailable: true };
    }
    // Exceeded hop budget: treat as a loop/excessive chain
    return { hops, finalUrl: current, isLoop: hops.length >= maxHops, traceAvailable: hops.length > 0 };
  } catch {
    return { hops, finalUrl: current, isLoop: false, traceAvailable: hops.length > 0 };
  }
}

function safeUrl(u: string): URL | null {
  try { return new URL(u); } catch { return null; }
}

const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, '');
const normPath = (p: string) => (p.replace(/\/+$/, '') || '/').toLowerCase();

/** True when two URLs differ only by protocol, www, trailing slash or case. */
export function isNormalizationOnly(a: string, b: string): boolean {
  const ua = safeUrl(a);
  const ub = safeUrl(b);
  if (!ua || !ub) return false;
  return stripWww(ua.hostname) === stripWww(ub.hostname) && normPath(ua.pathname) === normPath(ub.pathname) && ua.search === ub.search;
}

function isLocaleRedirect(requested: URL, final: URL): boolean {
  const reqSegs = requested.pathname.split('/').filter(Boolean);
  const finSegs = final.pathname.split('/').filter(Boolean);
  // /in -> /, / -> /en-US/, /en-us/x -> /x, /x -> /fr/x
  if (reqSegs.length && isLocaleSegment(reqSegs[0])) {
    const rest = reqSegs.slice(1).join('/');
    const finRest = (finSegs.length && isLocaleSegment(finSegs[0]) ? finSegs.slice(1) : finSegs).join('/');
    if (rest.toLowerCase() === finRest.toLowerCase()) return true;
  }
  if (finSegs.length && isLocaleSegment(finSegs[0])) {
    const finRest = finSegs.slice(1).join('/');
    if (finRest.toLowerCase() === reqSegs.join('/').toLowerCase()) return true;
  }
  // Country subdomain: in.example.com -> example.com
  const reqHost = stripWww(requested.hostname).split('.');
  const finHost = stripWww(final.hostname).split('.');
  if (reqHost.length !== finHost.length && (isLocaleSegment(reqHost[0]) || isLocaleSegment(finHost[0]))) {
    if (reqHost.slice(-2).join('.') === finHost.slice(-2).join('.')) return true;
  }
  return false;
}

/**
 * Classifies a redirect into a semantic kind. Pure function — unit-testable.
 */
export function classifyRedirect(input: {
  requestedUrl: string;
  finalUrl: string;
  hops?: RedirectHop[];
  isLoop?: boolean;
  traceAvailable?: boolean;
}): RedirectAnalysis {
  const hops = input.hops || [];
  const requested = safeUrl(input.requestedUrl);
  const final = safeUrl(input.finalUrl);
  const isLoop = !!input.isLoop;
  const httpRedirectCount = hops.length;
  const differs = requested && final
    ? !(stripWww(requested.hostname) === stripWww(final.hostname) && normPath(requested.pathname) === normPath(final.pathname) && requested.protocol === final.protocol && requested.search === final.search)
    : input.requestedUrl !== input.finalUrl;
  const isClientSide = differs && httpRedirectCount === 0 && !!input.traceAvailable;

  const statuses = hops.map(h => h.status);
  const permanent = statuses.length === 0 ? null : statuses.every(s => s === 301 || s === 308);

  let kind: RedirectKind = 'none';
  if (isLoop) kind = 'loop';
  else if (!differs && httpRedirectCount === 0) kind = 'none';
  else if (httpRedirectCount >= 3) kind = 'chain';
  else if (requested && final) {
    if (isNormalizationOnly(input.requestedUrl, input.finalUrl)) kind = 'normalization';
    else if (isLocaleRedirect(requested, final)) kind = 'locale';
    else if (stripWww(requested.hostname) !== stripWww(final.hostname) &&
             stripWww(requested.hostname).split('.').slice(-2).join('.') !== stripWww(final.hostname).split('.').slice(-2).join('.')) kind = 'cross_domain';
    else if (!isRootOrLocaleRoot(requested.pathname) && isRootOrLocaleRoot(final.pathname)) kind = 'to_homepage';
    else kind = 'path_change';
  }

  return {
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    hops,
    httpRedirectCount,
    isClientSide,
    isLoop,
    kind,
    permanent,
    traceAvailable: !!input.traceAvailable,
  };
}
