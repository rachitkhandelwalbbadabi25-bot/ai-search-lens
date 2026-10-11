# AI Search Lens --- SEO Page Auditor

## Technical Specification / Build Blueprint

**Project:** TinyFish Technical Student Bounty Drop 001\
**Product:** AI Search Lens\
**Goal:** Audit any publicly accessible webpage for SEO/search
visibility and AI-crawler readability using live-page evidence and
TinyFish Search + Fetch.

------------------------------------------------------------------------

## 1. Product Definition

AI Search Lens is a page-level SEO and AI-search visibility auditor.

The core principle is:

> **Do not audit only a domain. Audit the exact webpage the user
> submits.**

A user can enter:

-   `example.com`
-   `www.example.com`
-   `https://example.com`
-   `example.com/pricing`
-   `example.com/blog/how-to-use-x`
-   `example.com/docs/getting-started`
-   `https://example.com/product/abc?plan=pro`

The system normalizes the input and starts the audit from that exact
page.

### Primary UX

1.  User sees **Enter website URL**
2.  User enters any URL/page path
3.  User clicks **Audit Page →**
4.  System validates and normalizes the URL
5.  TinyFish Fetch reads the exact submitted page
6.  TinyFish Search gathers discovery/search context
7.  Analysis engine evaluates the evidence
8.  User receives a 0--100 score, findings, evidence, and prioritized
    fixes

------------------------------------------------------------------------

# 2. Core Requirements

## P0 --- Must Have

### R1. Any-page URL support

The application MUST accept a specific page URL, not just a root domain.

Examples:

-   `/pricing`
-   `/docs/...`
-   `/blog/...`
-   `/product/...`
-   `/case-studies/...`

The audit target MUST remain the exact submitted page.

### R2. URL normalization

Accept:

``` text
example.com
www.example.com
https://example.com
http://example.com/page
example.com/page
```

Normalize safely to an absolute URL.

Do not blindly alter an already-valid URL.

### R3. Exact-page Fetch

TinyFish Fetch MUST be used to retrieve/read the submitted live page.

The fetched content is the primary evidence source.

Capture, where available:

-   page title
-   meta description
-   canonical
-   headings
-   visible text
-   structured data
-   robots directives
-   links
-   images/alt text
-   content structure
-   status/response information
-   important rendered content

### R4. TinyFish Search

TinyFish Search MUST be meaningfully used to test discoverability/search
visibility.

Search should be based on the page's likely topic/entity/intent rather
than only searching the exact URL.

The system should collect useful search evidence such as:

-   whether the page/domain appears
-   competing/result pages
-   title/snippet quality
-   search intent alignment
-   discoverability signals

### R5. Actionable report

The report MUST not stop at a score.

Every important issue should contain:

-   severity
-   category
-   what was found
-   evidence
-   why it matters
-   exact recommended fix
-   expected impact

### R6. Visibility ↔ AI-readability connection

The report MUST explicitly explain the relationship between:

-   search/discovery visibility
-   page readability/understandability for AI systems

Example:

> The page may be technically indexable, but weak information
> architecture makes the main answer difficult for AI systems to extract
> and confidently cite.

------------------------------------------------------------------------

# 3. Audit Pipeline

``` text
User Input
   ↓
URL Validation
   ↓
URL Normalization
   ↓
Exact Page Target Lock
   ↓
TinyFish Fetch ───────────────┐
   ↓                          │
Page Evidence Extraction      │
                              │
Page Topic / Intent Analysis  │
   ↓                          │
TinyFish Search ──────────────┘
   ↓
Discovery + SERP Evidence
   ↓
SEO Rule Engine
   ↓
AI Readability Engine
   ↓
Visibility Analysis
   ↓
Scoring + Prioritization
   ↓
Actionable Audit Report
```

------------------------------------------------------------------------

# 4. Architecture

## Frontend

Recommended:

-   React
-   TypeScript
-   Tailwind CSS

Main screens:

### Landing / Audit Screen

Components:

-   product logo
-   headline
-   URL input
-   `Audit Page →` CTA
-   short explanation
-   example URL

Suggested copy:

> **Audit any webpage for Search + AI visibility.**

Input placeholder:

> `example.com/pricing`

CTA:

> `Audit Page →`

### Audit Progress Screen

Show real stages:

``` text
✓ URL validated
✓ Fetching submitted page
✓ Reading page structure
✓ Testing search discoverability
● Analyzing AI readability
○ Building recommendations
```

Do not fake progress. Stage completion should correspond to actual
backend work.

### Results Screen

Sections:

1.  Overall score
2.  Executive summary
3.  Search visibility
4.  AI readability
5.  Technical SEO
6.  Content / intent
7.  Evidence
8.  Priority fixes
9.  Exact-page details

------------------------------------------------------------------------

# 5. Backend

Recommended:

-   Node.js / TypeScript or Python
-   Server/API route
-   TinyFish integration
-   LLM analysis layer
-   deterministic SEO rule engine

Suggested API:

``` http
POST /api/audit
Content-Type: application/json
```

Request:

``` json
{
  "url": "example.com/pricing",
  "query": "optional user search query"
}
```

Response shape:

``` json
{
  "targetUrl": "https://example.com/pricing",
  "score": 78,
  "summary": "...",
  "visibility": {},
  "aiReadability": {},
  "technicalSeo": {},
  "content": {},
  "findings": [],
  "evidence": [],
  "recommendations": []
}
```

------------------------------------------------------------------------

# 6. URL Handling

## Validation

Reject:

-   empty input
-   unsupported protocols
-   malformed URLs
-   local/private network targets
-   unsupported schemes such as `file://`

Allow:

-   HTTP
-   HTTPS

Prefer HTTPS when the user omits the scheme.

### Important

Do not reduce:

``` text
example.com/pricing
```

to:

``` text
example.com
```

The path is part of the audit target.

------------------------------------------------------------------------

# 7. TinyFish Usage

TinyFish is central to the product rather than an invisible
implementation detail.

## TinyFish Fetch

Use Fetch to inspect the actual submitted live page.

The product should be able to answer:

> "What does this exact page currently expose to search engines and AI
> systems?"

## TinyFish Search

Use Search to evaluate whether the topic/page is discoverable in
search-like contexts.

Search evidence should complement, not replace, the exact-page Fetch.

## Evidence principle

Never claim a page has an issue without evidence when the issue can be
observed from the live page/search result.

------------------------------------------------------------------------

# 8. Audit Categories

## A. Technical SEO

Check:

-   HTTPS
-   status/accessibility
-   title
-   meta description
-   canonical
-   robots directives
-   indexability signals
-   heading hierarchy
-   viewport/mobile signals where observable
-   internal links
-   image alt text
-   structured data/schema
-   duplicate/weak metadata
-   broken or suspicious links where detectable

## B. Content Quality

Check:

-   clear primary topic
-   search intent alignment
-   topical completeness
-   useful information
-   content depth
-   unnecessary fluff
-   freshness signals where observable
-   keyword/topic coverage without keyword stuffing

## C. AI Readability

Check whether an AI system can quickly identify:

-   what the page is about
-   who it is for
-   the main answer/value
-   important entities
-   facts
-   product/service details
-   supporting evidence
-   relationships between sections

Check for:

-   clear headings
-   concise definitions
-   descriptive section titles
-   structured lists/tables where appropriate
-   semantic HTML signals
-   important content hidden behind interaction where possible
-   ambiguous navigation
-   excessive boilerplate

## D. Search Visibility

Use TinyFish Search evidence to assess:

-   discoverability
-   query/page alignment
-   title/snippet usefulness
-   result competitiveness
-   whether the page appears for a relevant query
-   whether another page is better positioned for the same intent

## E. AI Citation Readiness

Assess whether the page contains information that an AI answer engine
could confidently:

1.  understand
2.  extract
3.  attribute
4.  cite

------------------------------------------------------------------------

# 9. Scoring Model

Overall score: **0--100**

Suggested weighting:

  Category               Weight
  -------------------- --------
  Technical SEO              25
  Search Visibility          25
  AI Readability             25
  Content & Intent           15
  Citation Readiness         10

Score must be explainable.

Example:

``` text
Overall: 74/100

Technical SEO: 21/25
Search Visibility: 16/25
AI Readability: 20/25
Content & Intent: 11/15
Citation Readiness: 6/10
```

Avoid arbitrary scoring.

Every deduction should map to a finding or evidence item.

------------------------------------------------------------------------

# 10. Severity Model

### Critical

Blocks crawling, indexing, access, or understanding.

### High

Major visibility/readability problem with meaningful expected impact.

### Medium

Important optimization opportunity.

### Low

Polish or incremental improvement.

Example finding:

``` json
{
  "severity": "high",
  "category": "ai-readability",
  "title": "Primary product value is difficult to identify",
  "evidence": "The first meaningful description appears several sections below the main heading.",
  "impact": "AI systems may have weaker confidence about the page's primary purpose.",
  "fix": "Add a concise value proposition immediately below the H1."
}
```

------------------------------------------------------------------------

# 11. Recommendation Engine

Recommendations should be concrete.

Bad:

> Improve your SEO.

Good:

> Rewrite the title to clearly state the product, audience, and primary
> benefit. Keep the main phrase near the beginning and avoid repeating
> the brand name unnecessarily.

Each recommendation should include:

``` text
Problem
Evidence
Why it matters
Exact fix
Priority
```

Prioritize by:

``` text
Impact × Confidence × Ease
```

------------------------------------------------------------------------

# 12. Evidence Model

Every audit finding should ideally have an evidence object.

``` json
{
  "source": "fetch",
  "location": "title",
  "observed": "...",
  "expected": "...",
  "confidence": 0.96
}
```

Search evidence:

``` json
{
  "source": "search",
  "query": "...",
  "result": "...",
  "relationshipToTarget": "competitor"
}
```

This makes the auditor explainable rather than a black-box score
generator.

------------------------------------------------------------------------

# 13. Optional User Query

The user may provide a query.

Example:

``` text
URL:
example.com/pricing

Query:
best AI resume analyzer for students
```

When supplied, the query should influence Search and intent analysis.

When no query is supplied, infer likely intent from the page.

Do not require a query.

------------------------------------------------------------------------

# 14. Exact-Page vs Domain Context

The exact submitted page is the primary audit target.

The parent domain may be used only as supporting context.

Example:

``` text
Submitted:
example.com/blog/ai-resume-guide
```

Primary:

``` text
/blog/ai-resume-guide
```

Supporting:

``` text
example.com
```

Never silently audit only the homepage.

------------------------------------------------------------------------

# 15. Results UX

## Header

``` text
AI Search Lens

https://example.com/pricing

74 / 100
Good — but several high-impact improvements remain
```

## Score Cards

``` text
Search Visibility     64
AI Readability        81
Technical SEO        86
Content & Intent      73
Citation Readiness    68
```

## Priority Fixes

``` text
1. HIGH — Improve page title
2. HIGH — Add clearer product definition
3. MEDIUM — Strengthen internal linking
4. MEDIUM — Add/repair structured data
5. LOW — Improve image alt descriptions
```

## Evidence

Each item should allow the user to understand why the score changed.

------------------------------------------------------------------------

# 16. Error Handling

### Page unavailable

Return:

> We couldn't access this page. Check that the URL is public and
> reachable.

### Invalid URL

Return:

> Enter a valid public webpage URL, such as `example.com/pricing`.

### TinyFish failure

Return a clear retryable error.

Do not fabricate audit results when live evidence was not collected.

### Partial audit

If one subsystem fails, clearly mark the report as partial.

Example:

> Search visibility could not be verified. Technical and
> page-readability findings are still available.

------------------------------------------------------------------------

# 17. Security

Because users can submit arbitrary URLs:

-   block localhost/private IP targets
-   prevent SSRF
-   enforce request timeouts
-   limit response size
-   restrict protocols
-   sanitize returned HTML
-   never expose API keys client-side
-   rate-limit audit endpoints
-   avoid executing arbitrary user-provided JavaScript outside the
    controlled browser environment

------------------------------------------------------------------------

# 18. Performance

Suggested target:

-   URL validation: \<1s
-   Fetch: dependent on TinyFish
-   Search: dependent on TinyFish
-   analysis: short and bounded
-   total target: preferably \<60s

Use parallelism where safe:

``` text
Fetch exact page
       +
Search discovery
       ↓
combined analysis
```

Do not sacrifice evidence quality just to reduce latency.

------------------------------------------------------------------------

# 19. MVP Acceptance Criteria

The MVP is complete when:

-   [ ] User can submit a root URL
-   [ ] User can submit a nested URL
-   [ ] User can submit a blog URL
-   [ ] User can submit a pricing/product/docs URL
-   [ ] URL without `https://` works
-   [ ] Exact submitted page is fetched
-   [ ] TinyFish Search is meaningfully used
-   [ ] TinyFish Fetch is meaningfully used
-   [ ] Report contains a 0--100 score
-   [ ] Report contains category scores
-   [ ] Report contains live evidence
-   [ ] Report contains prioritized fixes
-   [ ] Report explains visibility vs AI readability
-   [ ] Search failures are not hidden
-   [ ] Fetch failures are not hidden
-   [ ] No fabricated findings are generated
-   [ ] Page-level auditing is preserved throughout the pipeline

------------------------------------------------------------------------

# 20. Demonstration Scenario

Use several real pages during final validation.

Example test set:

``` text
https://example.com/
https://example.com/pricing
https://example.com/blog/...
https://example.com/docs/...
```

For each:

1.  Submit exact URL
2.  Confirm exact URL appears in audit
3.  Confirm Fetch reads that page
4.  Confirm Search produces useful context
5.  Confirm findings reference the page
6.  Confirm recommendations are specific

The demo should clearly prove that this is a **page auditor**, not
merely a domain checker.

------------------------------------------------------------------------

# 21. Product Principle

The strongest differentiator is:

> **Paste any page. Get an evidence-backed Search + AI visibility audit
> of that exact page.**

The product should make the relationship clear:

``` text
Can search systems discover it?
             ↓
Can crawlers read it?
             ↓
Can AI systems understand it?
             ↓
Can they confidently extract and cite it?
```

That is the core of AI Search Lens.
