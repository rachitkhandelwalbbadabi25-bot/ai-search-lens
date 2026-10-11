# AI SEARCH LENS — COMPREHENSIVE PRODUCT ANALYSIS & ARCHITECTURAL MASTERPLAN

**Project:** AI Search Lens — SEO & AI Visibility Page Auditor  
**Bounty:** TinyFish Technical Student Bounty Drop 001  
**Status:** Architectural Blueprint & Implementation Plan  
**Document Target:** Single Source of Architectural Truth  

---

## 1. Product Understanding

### What AI Search Lens Is
**AI Search Lens** is an evidence-backed, page-level SEO and AI search visibility auditor. It takes any publicly accessible webpage URL (e.g., landing pages, blog posts, pricing pages, documentation) and evaluates how discoverable, readable, extractable, and citeable that **exact page** is for traditional search engines (Google/Bing) and AI answer engines (Perplexity, SearchGPT, Gemini, ChatGPT browsing).

### What Problem It Solves
1. **The AI Search Gap:** Traditional SEO tools (Ahrefs, Semrush, Lighthouse) focus on domain-level backlinks, page speed, or keyword density. However, AI answer engines crawl and parse pages to construct direct answers. A page can have good technical SEO but still fail to be cited by an AI if its content structure is ambiguous, generic, or hidden behind heavy boilerplate.
2. **Domain-Centric Overwhelm:** Most auditors evaluate the root domain (`example.com`) rather than specific conversion or content pages (`example.com/pricing` or `example.com/docs/getting-started`).
3. **Lack of Evidence:** Generic tools output black-box scores without providing the concrete on-page or search snippet evidence that explains *why* a deduction occurred.

### Who the Target Users Are
* **Primary:** Developers, SaaS Founders, Student Builders, Content Marketers, SEO Beginners.
* **Secondary:** Growth Marketers, Technical SEO Consultants, Web Agencies.

### Core User Journey
1. **Input:** User submits a specific URL (e.g., `example.com/pricing`) and optionally an intended search query (e.g., *"best AI resume analyzer for students"*).
2. **Validation & Locking:** System normalizes and locks the exact target page URL.
3. **Evidence Collection:** TinyFish Fetch reads the live submitted page; TinyFish Search investigates discovery context and competition on SERP.
4. **Analysis & Scoring:** Rule-engine & LLM evaluate page evidence across 5 core categories and calculate a deterministic 0–100 score.
5. **Actionable Output:** User receives a structured report with exact page findings, evidence snippets, visibility vs. readability diagnosis, and prioritized fixes sorted by impact.

### What Makes This Different From a Basic SEO Checker
| Feature | Basic SEO Checker | AI Search Lens |
| :--- | :--- | :--- |
| **Audit Scope** | Root Domain / High-level site health | **Exact submitted URL / Page-level** |
| **Search Engine Target** | Traditional SERP Rank / Keywords | **Traditional Search + AI Answer Engines (Perplexity/SearchGPT)** |
| **Evaluation Depth** | Meta tags, broken links, performance | **AI Readability, Entity Clarity, Citation Readiness** |
| **Evidence System** | Generic pass/fail counts | **Observed page DOM & search snippet evidence** |
| **Scoring Mechanism** | Black-box proprietary algorithm | **Deterministic, explainable deductions linked to evidence** |
| **Integration Core** | Custom scraping / Lighthouse | **Deep TinyFish Fetch + TinyFish Search integration** |

---

## 2. Critical Product Requirement: Page-Level Targeting

### Non-Negotiable Rule
**AI Search Lens is an EXACT PAGE-LEVEL auditor, NOT a domain-only auditor.**

If a user inputs:
`example.com/pricing`

The target page MUST remain `https://example.com/pricing`.  
The system **must never**:
* Strip the path and audit `https://example.com`
* Redirect the audit scope to the root domain
* Evaluate only homepage metadata

### Supported URL Patterns
* Root domains: `example.com`, `https://www.example.com`
* Product / Pricing paths: `example.com/pricing`, `example.com/product/suite`
* Content paths: `example.com/blog/2026-seo-guide`, `example.com/case-studies/acme`
* Technical docs: `example.com/docs/api/authentication`
* URLs with query params: `https://example.com/features?ref=nav`

### Architectural Preservation Strategy
1. **Input Normalization Layer:** Converts `example.com/pricing` -> `https://example.com/pricing` while strictly retaining pathname and search parameters.
2. **Immutable Target Context:** The target object (`{ targetUrl: string, host: string, path: string }`) is locked upon submission and passed explicitly to TinyFish Fetch, Evidence Extractor, Analysis Engines, and UI displays.
3. **Scope Guardrails:** Parent domain details (`example.com`) may only be collected as secondary baseline context (e.g., checking if root domain ranks on search), but 100% of audit findings and score deductions are bound strictly to the page at `targetUrl`.

---

## 3. TinyFish Architecture

TinyFish is the foundation of AI Search Lens. It provides two essential capabilities: **TinyFish Fetch** and **TinyFish Search**.

```
                           ┌────────────────────────┐
                           │   Target Webpage URL   │
                           └───────────┬────────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        ┌────────────────────────┐         ┌────────────────────────┐
        │     TinyFish Fetch     │         │    TinyFish Search     │
        │  (Live Page Extraction)│         │ (SERP & Visibility)    │
        └────────────┬───────────┘         └────────────┬───────────┘
                     │                                   │
                     ▼                                   ▼
        • Raw HTML & Rendered DOM           • Domain SERP Presence
        • Title, Meta Description           • Top Ranking Competitors
        • Headings (H1-H4 Hierarchy)        • SERP Snippet Quality
        • Schema.org / JSON-LD Data         • Query-Intent Alignment
        • Main Content Text Body            • Discovery Indexing Signals
        • Images & Alt Attributes           • Search Visibility Score
        • Canonical & Robots Directives     
                     │                                   │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │ Unified Page Evidence Payload │
                       └───────────────────────────────┘
```

### 1. TinyFish Fetch — Live Page Extraction
* **Role:** Reads the exact submitted page DOM/content as seen by crawlers and browser engines.
* **Payload Collected:**
  * Status code, headers, canonical URL, robots tags (`noindex`, `nofollow`).
  * Headings (`<h1>` through `<h4>`) hierarchy.
  * Title tag and Meta description text & length.
  * Clean visible main body text (strip script/nav/footer noise).
  * Structured data blocks (Schema.org / JSON-LD).
  * Image list, total images count, missing alt text count.
  * Semantic HTML elements (`<article>`, `<main>`, `<section>`, `<aside>`).

### 2. TinyFish Search — Search Visibility & Discovery Context
* **Role:** Investigates whether the page/topic is discoverable in search engine results.
* **Queries Executed:**
  1. *User Query (if supplied):* Directly searches the user's target query to check if `targetUrl` or host domain appears.
  2. *Inferred Query (if no query supplied):* Search query constructed from the page title / H1 (e.g., `[H1 Topic] + [Domain Brand]`).
* **Payload Collected:**
  * Presence indicator (Is target URL in top 20 results?).
  * Target domain search snippet (Title & description displayed on SERP).
  * Competing URLs ranking for the same intent.
  * Search intent alignment score.

### 3. Combination & Consumption
Outputs from Fetch and Search are normalized into a unified `PageEvidencePayload` object. The **SEO Rule Engine** and **LLM Readability Analyzer** consume this single payload to produce deterministic deductions and actionable findings.

### 4. Resiliency & Fallback Strategy (No Fabricated Data)
* **If Fetch Fails:** The audit cannot inspect the page structure. The system halts analysis and returns a clear error: *"Page reading failed. No fabricated findings will be generated."*
* **If Search Fails:** Fetch evidence is still valid. The system completes Technical SEO and AI Readability analysis, marks Search Visibility as `"unverified"`, applies no score penalties for search, and returns a **Partial Audit Report**.
* **Zero Fabrication Rule:** If evidence cannot be retrieved, the system *never* invents HTML tags, missing metadata, or competitor snippets. Missing signals are recorded as `null` / `unverified`.

---

## 4. Complete System Architecture

### Pipeline Breakdown

```
User Input
  └─► 1. URL Validation (Format, scheme, security sanity)
        └─► 2. URL Normalization (Add protocol, sanitize, preserve path)
              └─► 3. Exact Target Lock (Immutable Target Context)
                    ├─► 4. TinyFish Fetch (Fetch live DOM/content)
                    │     └─► 5. Page Evidence Extraction (Parse DOM & metadata)
                    ├─► 6. TinyFish Search (Investigate SERP & competitors)
                    │     └─► 7. Search Evidence Extraction (Parse SERP snippets)
                    └─► 8. SEO Rule Engine (Deterministic checks)
                          └─► 9. AI Readability Analyzer (LLM evaluation)
                                └─► 10. Content & Intent Engine (LLM evaluation)
                                      └─► 11. Citation Readiness Evaluator (LLM evaluation)
                                            └─► 12. Scoring Engine (Deterministic penalty calculation)
                                                  └─► 13. Prioritization & Fix Engine (Sort by Impact/Ease)
                                                        └─► 14. Actionable Final Audit Report
```

### Detailed Stage Specifications

| Stage | Responsibility | Inputs | Outputs | Dependencies | Failure Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. URL Validation** | Verify input safety & syntax | Raw input string | Validated URL string | Validator utility | Reject with user error message |
| **2. URL Normalization** | Ensure absolute URL while keeping path | Validated string | `https://example.com/path` | URL parser | Fallback to default `https://` prefix |
| **3. Exact Target Lock** | Freeze target URL context | Normalized URL | Immutable Target Context | Node `URL` | Hard abort if invalid |
| **4. TinyFish Fetch** | Read live target page DOM | Immutable URL | Raw HTML / Rendered JSON | TinyFish Fetch API | Abort audit with `FETCH_FAILED` |
| **5. Evidence Extraction** | Extract DOM structures, tags & Schema | Raw HTML / DOM | `PageStructureData` | Cheerio / Parser | Extract partial DOM features |
| **6. TinyFish Search** | Search SERP for topic & domain | Target URL + Query | SERP results & Snippets | TinyFish Search API | Mark Search as `unverified` (Partial Audit) |
| **7. Search Evidence** | Format competitor & SERP data | Raw SERP results | `SearchVisibilityData` | Evidence parser | Return empty search evidence |
| **8. SEO Rule Engine** | Deterministic technical checks | `PageStructureData` | Technical Findings | Rule list | Skip missing fields without crashing |
| **9. AI Readability Engine**| Evaluate structural clarity & entity definitions | DOM text + Headings | AI Readability Findings | LLM (Gemini 2.5 / 1.5) | Fallback to heuristic structural checks |
| **10. Content/Intent Engine**| Evaluate topic depth & fluff | DOM text + SERP query | Content Findings | LLM (Gemini 2.5 / 1.5) | Fallback to length/heading ratio heuristics |
| **11. Citation Readiness**| Evaluate claim clarity & citeability | DOM text + Schema | Citation Findings | LLM (Gemini 2.5 / 1.5) | Fallback to basic claim presence score |
| **12. Scoring Engine** | Sum weights & calculate penalties | All Findings | 0–100 Scores (Overall & 5 Categories) | Scoring Model | Enforce bounds [0, 100] |
| **13. Prioritization** | Rank fixes by Impact x Confidence | All Findings | Sorted Fixes List | Priority Engine | Default sort by severity (Critical -> Low) |
| **14. Final Report** | Assemble UI-ready response | All outputs | `AuditReportJSON` | Schema validator | Render UI error fallback if broken |

---

## 5. Technical Architecture & Codebase Inspection

### Current Codebase Status
Inspection of `c:\Users\rrach\OneDrive\Desktop\ai search lens` confirms:
* **Existing Files:** Only `ai_search_lens.prd` and `ai_search_lens_technical_spec.md`.
* **Codebase Status:** Clean-slate project. No existing code, frameworks, or configurations exist.

### Recommended Technology Stack
To deliver a high-performance, modern, and production-ready application that fulfills all PRD requirements:

* **Framework:** Next.js 14+ (App Router) with TypeScript.
* **Styling & UI:** Tailwind CSS / CSS Modules with modern UI design tokens (Glassmorphism, crisp dark mode, CSS variables, Google Fonts Inter/Outfit).
* **DOM & Evidence Extraction:** `cheerio`, `jsdom`, or native regex/DOM parsers.
* **AI / LLM Integration:** `@google/genai` using Gemini 2.5 Flash / 1.5 Pro for sub-second, structured JSON outputs.
* **External APIs:** TinyFish Web API (Search & Fetch endpoints).
* **Validation & Security:** `zod` for API contracts, custom SSRF IP filter (`ipaddr.js`).

---

## 6. Data Contracts

The architecture mandates strict, typed JSON data structures between all components to guarantee determinism.

### 1. Unified Audit Request (Frontend -> API)
```typescript
export interface AuditRequest {
  url: string;
  query?: string; // Optional user search query
}
```

### 2. Immutable Target Context
```typescript
export interface TargetContext {
  originalInput: string;
  normalizedUrl: string; // e.g. "https://example.com/pricing"
  protocol: 'http:' | 'https:';
  hostname: string;      // e.g. "example.com"
  pathname: string;      // e.g. "/pricing"
  searchParams: string;  // e.g. "?ref=nav"
  isRootDomain: boolean; // false for /pricing
}
```

### 3. Single Finding Object
```typescript
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Category = 'technical_seo' | 'search_visibility' | 'ai_readability' | 'content_intent' | 'citation_readiness';

export interface AuditFinding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  evidence: {
    source: 'fetch' | 'search' | 'analysis';
    location: string;    // e.g. "head > title", "h1 > text", "SERP position 4"
    observed: string;    // Raw string observed
    expected: string;    // What was expected
    snippet?: string;    // Short code/text snippet
  };
  whyItMatters: string;
  recommendedFix: string;
  expectedImpact: string;
  confidence: number;   // 0.0 to 1.0
  deductionPoints: number; // e.g. 5
}
```

### 4. Audit Report Schema (API -> Frontend Output)
```typescript
export interface CategoryScore {
  score: number;        // Earned score (e.g. 21)
  maxScore: number;     // Max category weight (e.g. 25)
  status: 'good' | 'warning' | 'critical' | 'unverified';
  summary: string;
}

export interface FinalAuditReport {
  targetContext: TargetContext;
  auditTimestamp: string;
  isPartialAudit: boolean;
  partialAuditReason?: string;
  overallScore: number; // 0 to 100
  summary: {
    headline: string;
    overview: string;
    visibilityVsReadabilityStatus: string;
  };
  categories: {
    technicalSeo: CategoryScore;
    searchVisibility: CategoryScore;
    aiReadability: CategoryScore;
    contentIntent: CategoryScore;
    citationReadiness: CategoryScore;
  };
  priorityFixes: AuditFinding[];
  allFindings: AuditFinding[];
  exactPageDetails: {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    headings: { level: string; text: string }[];
    structuredDataTypes: string[];
    totalImages: number;
    missingAltCount: number;
    robotsDirectives: string | null;
  };
}
```

---

## 7. Scoring System

### Category Weight Distribution
The overall score is calculated out of 100 points based on 5 weighted categories:

$$\text{Overall Score} = S_{\text{TechSEO}} + S_{\text{SearchVis}} + S_{\text{AIRead}} + S_{\text{Content}} + S_{\text{Citation}}$$

| Category | Max Weight | Deduction Triggers (Examples) |
| :--- | :---: | :--- |
| **Technical SEO** | **25 pts** | Missing Title (-5), Missing H1 (-5), No Canonical (-3), Missing Alt text (-3), Broken JSON-LD (-4), Non-HTTPS (-5) |
| **Search Visibility** | **25 pts** | Page not indexed on SERP (-10), Poor SERP snippet (-5), Dominant competitor positioning (-5), Keyword mismatch (-5) |
| **AI Readability** | **25 pts** | Ambiguous main answer (-8), Lack of clear subheadings (-5), Jargon/Boilerplate overload (-5), Hidden main text (-7) |
| **Content & Intent** | **15 pts** | Thin content / Under 300 words (-5), Mismatched search intent (-5), Fluff & repetitive text (-5) |
| **Citation Readiness**| **10 pts** | No un-ambiguous entity definitions (-4), Missing verifiable facts/data (-3), Un-attributed claims (-3) |

### Deterministic Calculation Formula
1. Each category starts with its maximum allocated points: $C_{\text{max}}$.
2. For every confirmed finding in category $C$, a penalty $P_i$ is applied based on severity:
   * **CRITICAL:** 8 to 10 points
   * **HIGH:** 5 to 7 points
   * **MEDIUM:** 3 to 4 points
   * **LOW:** 1 to 2 points
3. Category Score: $S_C = \max\left(0,\, C_{\text{max}} - \sum P_i\right)$
4. Total Score: $\text{Overall} = \sum S_C$
5. **Traceability:** Every deducted point is directly tied to a `deductionPoints` value on a specific `AuditFinding`. **No arbitrary scores are generated by the LLM.**

---

## 8. Evidence System

The Evidence System guarantees that every audit statement is backed by real page HTML or real search SERP data.

### Evidence Structure & Representation
* **Fetch Evidence (DOM & Structural):**
  * `source`: `"fetch"`
  * `location`: Specific HTML tag or selector (e.g., `<head> > meta[name="description"]`, `body > h1:first-of-type`)
  * `observed`: Actual string in the DOM (e.g., `""` or `"Home - My Company"`)
  * `expected`: Recommended DOM value (e.g., `"Pricing & Plans - My Company | Affordable AI Tools"`)
* **Search Evidence (SERP & Indexing):**
  * `source`: `"search"`
  * `location`: Google/Search SERP Position #1–20
  * `observed`: Competitor snippet: *"Top 10 Resume Tools in 2026"*
  * `expected`: Page appearing in Top 5 for target query `[best AI resume analyzer]`

---

## 9. Security Architecture

Allowing users to submit arbitrary web URLs introduces severe security risks. The backend security layer mandates:

```
User Submits URL
   │
   ▼
[ 1. URL Scheme Check ] ──► Reject non-http/https (file://, gopher://, ftp://)
   │
   ▼
[ 2. Hostname / IP Filtering ] ──► Resolve DNS & Block SSRF
   │                               (Reject 127.0.0.1, 10.x, 172.16-31.x, 192.168.x, ::1, .local)
   ▼
[ 3. Size & Timeout Limits ] ──► Abort if payload > 5MB or response time > 15s
   │
   ▼
[ 4. Content Sanitization ] ──► Strip <script>, <iframe>, and event attributes before processing
   │
   ▼
[ 5. Server-Side API Isolation ] ──► TinyFish & LLM API keys stored strictly in process.env
```

1. **SSRF Safeguards:**
   * Validate scheme (`http:` or `https:` only).
   * Resolve target domain to IP address server-side before request.
   * Reject all private, loopback, link-local, and broadcast IP ranges (RFC 1918, RFC 4193).
2. **Payload & Execution Safeguards:**
   * Response payload size capped at 5 MB.
   * Fetch timeout strictly limited to 15 seconds.
   * Strip all executable `<script>`, `<style>`, `<iframe>`, and Inline Event Handlers (`onload`, `onclick`) from fetched HTML before parsing.
3. **API Key Protection:**
   * `TINYFISH_API_KEY` and `GEMINI_API_KEY` reside exclusively in backend environment variables. Never exposed to the browser.
4. **Rate Limiting:**
   * Limit client IP requests to 10 audits per minute to prevent API abuse.

---

## 10. Performance Plan

To keep the full audit under **45–60 seconds** within serverless execution limits:

```
                          ┌────────────────────────┐
                          │  URL Target Locked     │
                          └───────────┬────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     │                                 │
          (If User Query Provided)             (If No Query Provided)
                     │                                 │
                     ▼                                 ▼
         ┌───────────────────────┐         ┌───────────────────────┐
         │ Parallel Execution    │         │ Pipeline Execution    │
         │ • TinyFish Fetch      │         │ 1. TinyFish Fetch     │
         │ • TinyFish Search     │         │ 2. Infer Query from H1│
         └───────────┬───────────┘         │ 3. TinyFish Search    │
                     │                     └───────────┬───────────┘
                     │                                 │
                     └────────────────┬────────────────┘
                                      │
                                      ▼
                        ┌────────────────────────────┐
                        │ Concurrent Analysis Engines│
                        │ • SEO Rule Engine (0.1s)   │
                        │ • Gemini LLM Evaluation(2s)│
                        └─────────────┬──────────────┘
                                      │
                                      ▼
                        ┌────────────────────────────┐
                        │   Deterministic Scoring    │
                        │     & UI Output (<0.1s)    │
                        └─────────────┬──────────────┘
```

1. **Concurrent API Requests:**
   * When an optional user query is provided, **TinyFish Fetch** and **TinyFish Search** run concurrently via `Promise.all()`.
2. **Fast Evaluation Engines:**
   * Technical SEO Rule Engine runs synchronously in Node.js (< 100ms).
   * Gemini 2.5 Flash LLM prompt is executed in a single structured schema call (< 2.5s).
3. **Target Latency Budget:**
   * Validation & Target Lock: **0.1s**
   * TinyFish Fetch + Search: **8.0s – 15.0s**
   * Extraction & SEO Rules: **0.2s**
   * LLM Readability & Citation Analysis: **2.5s – 4.0s**
   * Scoring & Assembly: **0.1s**
   * **Total Expected Duration:** **11s – 20s** (Well within the 60s budget).

---

## 11. Error & Partial Results Strategy

| Scenario | Handling Strategy | User Display |
| :--- | :--- | :--- |
| **Invalid / Private URL** | Stop immediately before API calls | Error alert: *"Enter a valid public webpage URL, such as example.com/pricing."* |
| **Unreachable Target Page** | Stop immediately if Fetch returns 404/500/Timeout | Error alert: *"We couldn't access this page. Check that the URL is public and reachable."* |
| **TinyFish Fetch Failure** | Abort audit. Do not generate fake DOM data | Error alert: *"Page reading failed. No fabricated findings will be generated."* |
| **TinyFish Search Failure** | Mark Search category as `unverified`. Proceed with Fetch evidence | Warning badge: *"Search visibility could not be verified. Technical and page-readability findings are still available."* |
| **LLM Analysis Failure** | Fallback to deterministic heuristic rule engine | Info badge: *"Readability evaluated using structural heuristic fallback."* |

---

## 12. Frontend UX & UI States

The UI will be built as a state-of-the-art, glassmorphism dark-mode web application.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI SEARCH LENS HEADER                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ [State 1: Landing Input Card]                                          │
│  • Headline: "Audit any webpage for Search + AI visibility."           │
│  • Input: [ https://example.com/pricing                  ]             │
│  • Optional Query: [ best AI resume analyzer for students ]            │
│  • Button: [ Audit Page → ]                                            │
│                                                                        │
│ ────────────────────────────────────────────────────────────────────── │
│                                                                        │
│ [State 2: Live Real Progress Stepper] (Visible during analysis)        │
│  ✓ Target URL validated and locked                                     │
│  ✓ Fetching live page structure via TinyFish Fetch                     │
│  ✓ Extracting DOM metadata & Schema.org data                           │
│  ● Investigating search discoverability via TinyFish Search            │
│  ○ Evaluating AI readability & citation readiness                      │
│  ○ Calculating deterministic score & prioritized fixes                 │
│                                                                        │
│ ────────────────────────────────────────────────────────────────────── │
│                                                                        │
│ [State 3: Interactive Results Dashboard]                               │
│  • Header: Target URL, Overall Score Badge (e.g. 78/100)               │
│  • Executive Summary & Visibility <-> Readability Connection Card      │
│  • 5 Category Score Cards (Technical, Search, AI, Content, Citation)   │
│  • Priority Fixes List (Sorted by Severity with Fix Instructions)      │
│  • Evidence Inspector (Observed DOM vs Expected Snippets)              │
│  • Exact Page Details Drawer (Raw Headings, Meta, JSON-LD)             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. MVP Scope vs Future Work

### P0 — Must Have (MVP Scope)
* Full support for any valid webpage URL (preserves exact path).
* URL validation, normalization, and private IP blocking.
* TinyFish Fetch integration for live page content.
* TinyFish Search integration for discovery context.
* Deterministic 0–100 overall score & 5 category sub-scores.
* Evidence-backed findings with severity, location, observed value, and fix.
* Search Visibility ↔ AI Readability connection explanation.
* Clear error states (Unreachable page, Search failed partial audit).
* Modern responsive dark-mode UI with live progression steps.

### P1 — Important Enhancements (Post-MVP)
* PDF audit export report download.
* Audit comparison mode (Compare `/pricing` vs competitor `/pricing`).
* Historical audit rerun history in browser localStorage.

### P2 — Future Scale
* Webhook notifications for page score drops.
* Batch multi-page sitemap auditing.

---

## 14. Requirement Gap Analysis

| Requirement | Existing? | Current Implementation | Missing Work | Priority |
| :--- | :---: | :--- | :--- | :---: |
| **PRD & Tech Spec** | Yes | Located in project root | Review complete | P0 |
| **Next.js 14 Web Project** | No | None | Initialize Next.js 14 App Router project | P0 |
| **URL Validator & Lock** | No | None | Build URL validation, SSRF guard & target lock utility | P0 |
| **TinyFish Fetch Client** | No | None | Build API wrapper for live page fetch | P0 |
| **TinyFish Search Client**| No | None | Build API wrapper for search discovery | P0 |
| **DOM Evidence Extractor**| No | None | Build Cheerio HTML & Schema parser | P0 |
| **Deterministic SEO Engine**| No | None | Write technical SEO rules & validator | P0 |
| **LLM Readability Analyzer**| No | None | Prompt engineering & Gemini API client | P0 |
| **Scoring Engine** | No | None | Implement deterministic category weight calculator | P0 |
| **Recommendation Engine**| No | None | Build priority sorting algorithm (Impact x Ease) | P0 |
| **UI Dashboard** | No | None | Build Landing, Stepper, Score Cards, Evidence & Fixes UI | P0 |

---

## 15. Step-by-Step Implementation Plan

### Phase 1 — Project Foundation & Setup
* **Files to create:** `package.json`, `tsconfig.json`, `next.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
* **Purpose:** Establish Next.js 14 project structure, styling variables, typography, and basic container layout.
* **Dependencies:** `next`, `react`, `lucide-react`, `zod`.
* **Acceptance Criteria:** `npm run dev` boots cleanly; baseline dark-mode UI tokens loaded.

### Phase 2 — URL Validation, Normalization & Target Lock
* **Files to create:** `src/lib/url-validator.ts`, `src/types/audit.ts`.
* **Purpose:** Implement URL parsing, protocol upgrading, pathname preservation, and SSRF security check.
* **Dependencies:** `ipaddr.js`, standard URL API.
* **Acceptance Criteria:** `example.com/pricing` -> `https://example.com/pricing` with `isRootDomain: false`. Localhost/127.0.0.1 inputs are cleanly rejected.

### Phase 3 — TinyFish Fetch Integration
* **Files to create:** `src/lib/tinyfish-fetch.ts`.
* **Purpose:** Send target URL to TinyFish Fetch API, retrieve raw HTML/DOM and headers.
* **Dependencies:** `fetch` / `axios`, `TINYFISH_API_KEY`.
* **Acceptance Criteria:** Successfully fetches exact target webpage content; returns error if unreachable without inventing fake DOM data.

### Phase 4 — Page Evidence Extraction Engine
* **Files to create:** `src/lib/evidence-extractor.ts`.
* **Purpose:** Parse fetched HTML for title, meta tags, H1-H4 hierarchy, structured data, canonical link, image alts, and main body text.
* **Dependencies:** `cheerio`.
* **Acceptance Criteria:** Returns typed `PageStructureData` payload containing extracted page features.

### Phase 5 — TinyFish Search Integration
* **Files to create:** `src/lib/tinyfish-search.ts`.
* **Purpose:** Query TinyFish Search API for keyword/topic discovery context, SERP snippets, and competitor URLs.
* **Dependencies:** `TINYFISH_API_KEY`.
* **Acceptance Criteria:** Returns SERP presence status and competitor search snippets. Handles failures gracefully by setting `unverified` status.

### Phase 6 — Technical SEO Rule Engine
* **Files to create:** `src/lib/engines/seo-engine.ts`.
* **Purpose:** Execute deterministic rules against `PageStructureData` (Title presence/length, H1 presence, Canonical correctness, Schema validity, Alt attributes).
* **Dependencies:** Typed findings schema.
* **Acceptance Criteria:** Produces verifiable technical SEO findings with exact DOM evidence and deduction points.

### Phase 7 — AI Readability & Citation Analyzer
* **Files to create:** `src/lib/engines/ai-readability-engine.ts`, `src/lib/gemini-client.ts`.
* **Purpose:** Execute structured LLM analysis (via Gemini API) evaluating structural clarity, entity definition, answer extractability, content depth, and citation readiness.
* **Dependencies:** `@google/genai`, `GEMINI_API_KEY`.
* **Acceptance Criteria:** Outputs structured JSON containing clarity ratings, citation readiness analysis, and specific readability findings.

### Phase 8 — Deterministic Scoring & Priority Recommendation Engine
* **Files to create:** `src/lib/engines/scoring-engine.ts`, `src/lib/engines/recommendation-engine.ts`.
* **Purpose:** Calculate overall 0–100 score and category scores using deductions from findings; rank fixes by priority ($Impact \times Confidence$).
* **Dependencies:** Findings arrays.
* **Acceptance Criteria:** Score equals 100 minus sum of category deductions. Priorities ordered from Critical -> Low.

### Phase 9 — Backend API Route Integration
* **Files to create:** `src/app/api/audit/route.ts`.
* **Purpose:** Assemble the complete audit pipeline into a unified POST API route supporting streaming/progress updates or single request execution.
* **Dependencies:** All lib engines.
* **Acceptance Criteria:** POST `/api/audit` returns `FinalAuditReport` JSON in under 20 seconds.

### Phase 10 — Frontend UI Dashboard
* **Files to create:** `src/components/Header.tsx`, `src/components/LandingInput.tsx`, `src/components/ProgressStepper.tsx`, `src/components/ScoreOverview.tsx`, `src/components/CategoryCards.tsx`, `src/components/PriorityFixes.tsx`, `src/components/EvidenceInspector.tsx`, `src/components/PageDetailsDrawer.tsx`.
* **Purpose:** Build high-end, responsive dark-mode dashboard showcasing all audit results, evidence, and fix recommendations.
* **Dependencies:** Lucide icons, Framer Motion (or CSS animations).
* **Acceptance Criteria:** Beautiful UI rendered seamlessly across desktop and mobile; exact target URL prominently displayed.

### Phase 11 — Security & Error Hardening
* **Files to create:** `src/middleware.ts` (rate limiting), error boundary components.
* **Purpose:** Apply request rate limits, wrap unexpected API errors, display clean error/partial audit banners.
* **Acceptance Criteria:** Gracefully handles invalid inputs, fetch timeouts, and search API outages.

### Phase 12 — End-to-End Verification & Bounty Demo Validation
* **Files to test:** Validation against real test set (`/`, `/pricing`, `/blog/...`, `/docs/...`).
* **Purpose:** Run comprehensive validation tests across diverse URLs to ensure exact page preservation and evidence accuracy.
* **Acceptance Criteria:** 100% compliance with PRD and Technical Specification.

---

## 16. Testing Strategy

1. **URL Targeting Tests:**
   * Test inputs: `example.com/pricing`, `https://example.com/blog/article?id=123`.
   * Verify that `targetContext.pathname` is preserved throughout the pipeline.
2. **Evidence Verifiability Tests:**
   * Verify that every finding contains non-empty `evidence.observed` or `evidence.location` strings.
3. **Scoring Integrity Tests:**
   * Pass mock findings with known point deductions and assert exact mathematical category scores.
4. **Security SSRF Tests:**
   * Attempt inputs: `http://localhost:3000`, `http://127.0.0.1/admin`, `http://169.254.169.254`.
   * Assert immediate rejection with HTTP 400.
5. **Partial Failure Tests:**
   * Mock TinyFish Search API failure and assert that Technical SEO and AI Readability reports complete successfully with a `isPartialAudit: true` flag.

---

## 17. Open Questions & Ambiguities

1. **TinyFish Search Fallback Strategy for Niche URLs:**
   * If a brand-new page (e.g., `example.com/blog/new-post-today`) has not been indexed by Google/SERP yet, TinyFish Search will return 0 presence. The system will mark Search Visibility accordingly without penalizing Technical SEO or AI Readability.
2. **User Search Query Inference:**
   * If the user does not supply an optional search query, the system automatically constructs a target intent query from the extracted H1 heading and page title.

---

## 18. Final Recommended Architecture

```
                               ┌─────────────────────────┐
                               │   User Web Browser UI   │
                               └────────────┬────────────┘
                                            │ HTTP POST /api/audit
                                            ▼
                               ┌─────────────────────────┐
                               │ Next.js API Route Guard │
                               │ (SSRF & Rate Limiter)   │
                               └────────────┬────────────┘
                                            │
                               ┌────────────┴────────────┐
                               │ Target URL Lock Context │
                               └────────────┬────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
        ┌────────────────────────┐                    ┌────────────────────────┐
        │   TinyFish Fetch API   │                    │  TinyFish Search API   │
        └────────────┬───────────┘                    └────────────┬───────────┘
                     │ Raw HTML                                    │ SERP Data
                     ▼                                             ▼
        ┌────────────────────────┐                    ┌────────────────────────┐
        │  Cheerio DOM Extractor │                    │ SERP Evidence Formatter│
        └────────────┬───────────┘                    └────────────┬───────────┘
                     │ Page Structure                              │ Search Signals
                     └──────────────────────┬──────────────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │ Unified Evidence Engine │
                               └────────────┬────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
        ┌────────────────────────┐                    ┌────────────────────────┐
        │  Deterministic Technical│                    │   Gemini 2.5 Flash     │
        │    SEO Rule Engine     │                    │  AI Readability Engine │
        └────────────┬───────────┘                    └────────────┬───────────┘
                     │ Findings & Deductions                       │ Findings & Deductions
                     └──────────────────────┬──────────────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │  Scoring & Fix Engine   │
                               │  (Deterministic Math)   │
                               └────────────┬────────────┘
                                            │ Final Audit Report JSON
                                            ▼
                               ┌─────────────────────────┐
                               │   Audit Dashboard UI    │
                               └─────────────────────────┘
```
