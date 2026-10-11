export interface FetchResult {
  url: string;
  statusCode: number;
  html: string;
  contentType: string;
  durationMs: number;
  viaTinyFish: boolean;
  pageTitle?: string | null;
  metaDescription?: string | null;
}

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * Executes a live fetch of the submitted webpage URL.
 * Uses TinyFish Fetch API (browser-rendered DOM) when TINYFISH_API_KEY is available,
 * or direct controlled browser-like HTTP fetch as fallback.
 */
export async function fetchLivePage(targetUrl: string): Promise<FetchResult> {
  const startTime = Date.now();
  const apiKey = process.env.TINYFISH_API_KEY;

  // 1. If TinyFish API key is present, attempt TinyFish Fetch API with rendered DOM format
  if (apiKey) {
    console.log('[TinyFish Fetch] API key detected, requesting browser-rendered DOM via TinyFish Fetch API...');
    try {
      const response = await fetch('https://agent.tinyfish.ai/v1/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          urls: [targetUrl],
          format: 'html',
        }),
        signal: AbortSignal.timeout(20000), // 20s timeout for browser execution
      });

      if (response.ok) {
        const data = await response.json();
        const first = data.results?.[0];
        const html = first?.html || first?.text || first?.content || '';
        const finalUrl = first?.final_url || targetUrl;
        const pageTitle = first?.title || null;
        const metaDescription = first?.description || null;

        if (html && html.length > 50) {
          console.log(`[TinyFish Fetch] Successfully retrieved rendered DOM via TinyFish API (${html.length} bytes in ${Date.now() - startTime}ms)`);
          return {
            url: finalUrl,
            statusCode: response.status,
            html,
            contentType: 'text/html',
            durationMs: Date.now() - startTime,
            viaTinyFish: true,
            pageTitle,
            metaDescription,
          };
        }
      } else {
        console.warn(`[TinyFish Fetch] TinyFish API returned HTTP status ${response.status}. Switching to direct fetch fallback.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[TinyFish Fetch] API call failed or timed out, switching to direct fetch fallback:', msg);
    }
  } else {
    console.log('[TinyFish Fetch] TINYFISH_API_KEY missing from environment. Using direct HTTP fetch fallback.');
  }

  // 2. Direct HTTP fetch fallback (for dev or direct live validation)
  try {
    console.log(`[TinyFish Fetch Fallback] Fetching targetUrl="${targetUrl}" via direct HTTP...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AI-Search-Lens/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new FetchError(`Page returned HTTP status ${response.status} ${response.statusText}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();

    // 5MB Response size cap check
    if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
      throw new FetchError('Page content exceeds maximum allowed size (5MB).');
    }

    const decoder = new TextDecoder('utf-8');
    const html = decoder.decode(arrayBuffer);

    console.log(`[TinyFish Fetch Fallback] Successfully fetched raw HTML (${html.length} bytes in ${Date.now() - startTime}ms)`);

    return {
      url: targetUrl,
      statusCode: response.status,
      html,
      contentType,
      durationMs: Date.now() - startTime,
      viaTinyFish: false,
    };
  } catch (err: unknown) {
    if (err instanceof FetchError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted')) {
      throw new FetchError('Page request timed out after 15 seconds.');
    }
    throw new FetchError(`We couldn't access this page. Check that the URL is public and reachable. (${message})`);
  }
}
