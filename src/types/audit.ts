/**
 * INFO = disclosed observation with zero score impact (e.g. intentional redirect,
 * missing canonical without duplicate evidence, unknown search visibility).
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type PageType =
  | 'homepage'
  | 'article'
  | 'documentation'
  | 'product'
  | 'pricing'
  | 'job'
  | 'profile'
  | 'login'
  | 'dashboard'
  | 'app'
  | 'category'
  | 'other';

export type RedirectKind =
  | 'none'
  | 'normalization'      // protocol / www / trailing-slash / case only
  | 'locale'             // locale/region path or subdomain redirect
  | 'path_change'        // old URL -> different, non-root URL
  | 'to_homepage'        // specific page -> site root
  | 'cross_domain'
  | 'chain'
  | 'loop';

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface RedirectAnalysis {
  requestedUrl: string;
  finalUrl: string;
  hops: RedirectHop[];          // HTTP-level hops (3xx responses)
  httpRedirectCount: number;
  isClientSide: boolean;        // final URL differs but no HTTP 3xx observed
  isLoop: boolean;
  kind: RedirectKind;
  permanent: boolean | null;    // true for 301/308, false for 302/303/307, null if unknown
  traceAvailable: boolean;
}

export type Category = 
  | 'technical_seo' 
  | 'search_visibility' 
  | 'ai_readability' 
  | 'content_intent' 
  | 'citation_readiness';

export interface AuditRequest {
  url: string;
  query?: string;
}

export interface TargetContext {
  originalInput: string;
  normalizedUrl: string; // e.g. "https://example.com/pricing"
  protocol: 'http:' | 'https:';
  hostname: string;      // e.g. "example.com"
  pathname: string;      // e.g. "/pricing"
  searchParams: string;  // e.g. "?ref=nav"
  isRootDomain: boolean; // false for /pricing
  isRedirected?: boolean;      // TRUE if final rendered URL !== requested URL
  finalUrl?: string | null;   // e.g. "https://example.com/"
  redirectPathname?: string;  // e.g. "/"
}

export interface FindingEvidence {
  source: 'fetch' | 'search' | 'analysis';
  location: string;    // e.g. "head > title", "h1 > text", "SERP position 4"
  observed: string;    // Raw string observed
  expected: string;    // What was expected
  snippet?: string;    // Short code/text snippet
}

export interface AuditFinding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  evidence: FindingEvidence;
  whyItMatters: string;
  recommendedFix: string;
  expectedImpact: string;
  confidence: number;    // 0.0 to 1.0
  /** Applied (authoritative) deduction after category budget capping. */
  deductionPoints: number; // e.g. 5
  /** Human-readable confidence bucket derived from `confidence`. */
  confidenceLevel?: ConfidenceLevel;
  /** Contextual reasoning that determined severity (e.g. page type, duplicate evidence). */
  context?: string;
  /** Deduction requested by the rule before category budget capping. */
  rawDeductionPoints?: number;
}

export interface CategoryScore {
  score: number;        // Earned score (e.g. 21)
  maxScore: number;     // Max category weight (e.g. 25)
  status: 'good' | 'warning' | 'critical' | 'unverified';
  summary: string;
}

export type EvidenceStatus = 'FOUND' | 'NOT_FOUND' | 'UNVERIFIED';

export interface BaseEvidenceSignal<T = string> {
  status: EvidenceStatus;
  value?: T | null;
  source?: string;
  reason?: string;
  snippet?: string;
}

export interface HeadMetadataEvidence {
  title: BaseEvidenceSignal<string>;
  metaDescription: BaseEvidenceSignal<string>;
  viewport: BaseEvidenceSignal<string>;
  canonical: BaseEvidenceSignal<string>;
  robotsMeta: BaseEvidenceSignal<string>;
  openGraph: {
    status: EvidenceStatus;
    title?: string | null;
    description?: string | null;
    siteName?: string | null;
    type?: string | null;
    source?: string;
    reason?: string;
  };
  twitterCard: {
    status: EvidenceStatus;
    card?: string | null;
    title?: string | null;
    description?: string | null;
    source?: string;
    reason?: string;
  };
}

export interface DetailedHeadingItem {
  level: number;
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  text: string;
  order: number;
  selector: string;
}

export interface HeadingEvidence {
  status: EvidenceStatus;
  h1Status: EvidenceStatus;
  count: number;
  h1Count: number;
  h2Count: number;
  headings: DetailedHeadingItem[];
  source?: string;
  reason?: string;
}

export interface StructuredDataFormatEvidence {
  status: EvidenceStatus;
  count: number;
  types: string[];
  blocks?: string[];
  source?: string;
  reason?: string;
}

export interface SchemaTypeDetail {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  source: string;
  entityId?: string;
}

export interface StructuredDataEvidence {
  status: EvidenceStatus;
  formatsDetected: ('json-ld' | 'microdata' | 'rdfa')[];
  types: string[];
  typesWithDetails?: SchemaTypeDetail[];
  schemaOrgName?: string | null;
  jsonLd: StructuredDataFormatEvidence;
  microdata: StructuredDataFormatEvidence;
  rdfa: StructuredDataFormatEvidence;
  source?: string;
  reason?: string;
}

export type EntityConfidenceTier = 'strong' | 'moderate' | 'weak' | 'none';

export interface EntityPublisherEvidence {
  status: EvidenceStatus;
  aboutLink: BaseEvidenceSignal<{ href: string; text: string; source: string }>;
  contactLink: BaseEvidenceSignal<{ href: string; text: string; source: string }>;
  careersLink?: BaseEvidenceSignal<{ href: string; text: string; source: string }>;
  socialProfiles: {
    status: EvidenceStatus;
    links: { url: string; platform: string; source: string }[];
    source?: string;
    reason?: string;
  };
  authorSignal: BaseEvidenceSignal<{ name?: string; source: string }>;
  publisherSignal: BaseEvidenceSignal<{ name?: string; source: string }>;
  dateSignal: BaseEvidenceSignal<{ date?: string; source: string }>;
  sameAsLinks: BaseEvidenceSignal<string[]>;
  copyrightSignal?: BaseEvidenceSignal<{ text: string; holder?: string; source: string }>;
  emailContact?: BaseEvidenceSignal<boolean>;
  phoneContact?: BaseEvidenceSignal<boolean>;
  organizationIdentity?: {
    status: EvidenceStatus;
    name: string | null;
    confidence: EntityConfidenceTier;
    sources: string[];
  };
}

export interface PageEvidenceState {
  headInspected: boolean;
  domInspected: boolean;
  head: HeadMetadataEvidence;
  headings: HeadingEvidence;
  structuredData: StructuredDataEvidence;
  entityPublisher: EntityPublisherEvidence;
}

export interface PageHeading {
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  text: string;
}

export interface PageStructureData {
  statusCode: number;
  url: string;
  finalUrl: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robotsMeta: string | null;
  headings: PageHeading[];
  h1Count: number;
  mainBodyText: string;
  wordCount: number;
  totalWordCount?: number;
  mainContentWordCount?: number;
  structuredDataTypes: string[];
  rawSchemaBlocks: string[];
  totalImages: number;
  imagesWithAltCount?: number;
  imagesWithEmptyAltCount?: number;
  imagesWithMissingAltCount?: number;
  missingAltCount: number;
  imagesWithoutAlt: { src: string; alt: string }[];
  internalLinksCount: number;
  externalLinksCount: number;
  hasHttps: boolean;
  hasViewportMeta: boolean;
  isRedirected?: boolean;
  evidenceState?: PageEvidenceState;

  // ---- Extended context signals (optional, additive) ----
  requestedUrl?: string;
  redirect?: RedirectAnalysis;
  renderedDom?: boolean;           // true when fetched via a rendering browser (TinyFish)
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogSiteName?: string | null;
  ogType?: string | null;
  htmlLang?: string | null;
  microdataTypes?: string[];
  rdfaTypes?: string[];
  hasJsonLd?: boolean;
  schemaOrgName?: string | null;   // Organization / WebSite name from JSON-LD
  sameAsLinks?: string[];
  socialProfileLinks?: string[];
  hasAboutLink?: boolean;
  hasContactLink?: boolean;
  hasCareersLink?: boolean;
  hasAuthorSignal?: boolean;
  hasPublisherSignal?: boolean;
  hasDateSignal?: boolean;
  organizationName?: string | null;
  organizationConfidence?: EntityConfidenceTier;
  copyrightText?: string | null;
  copyrightHolder?: string | null;
  hasEmailContact?: boolean;
  hasPhoneContact?: boolean;
  introText?: string;              // first substantive text after the H1 (empty when no H1)
  firstParagraphText?: string;     // first substantive paragraph on the page
  paragraphCount?: number;
  answerFriendlyParagraphs?: number; // paragraphs of 15–80 words
  longParagraphs?: number;           // paragraphs > 150 words
  listCount?: number;
  tableCount?: number;
  formCount?: number;
  hasPasswordInput?: boolean;
  interactiveElementCount?: number;  // buttons + inputs + selects + textareas
  pageType?: PageType;
}

export interface CompetitorSnippet {
  title: string;
  url: string;
  snippet: string;
  isTargetDomain: boolean;
  isExactTargetUrl: boolean;
  position: number;
}

export interface SearchVisibilityData {
  queryUsed: string;
  isInferredQuery: boolean;
  targetPresentInSerp: boolean;
  targetDomainPresentInSerp: boolean;
  targetRankPosition: number | null; // e.g. 3 or null if not found
  targetSerpTitle: string | null;
  targetSerpSnippet: string | null;
  topCompetitors: CompetitorSnippet[];
  searchIntent: string;
  queryPageAlignmentScore: number; // 0-100
  isSearchUnverified?: boolean;
  searchStatus?: 'FOUND' | 'NOT_FOUND' | 'UNVERIFIED';
  searchedAt?: string;
  provider?: 'tinyfish' | 'bing' | 'none';
  searchErrorMessage?: string;

  // ---- Multi-query visibility evidence (optional, additive) ----
  queries?: QueryVisibilityResult[];
  visibilityTier?: VisibilityTier;
  visibilityScore?: number;          // 0.0–1.0 weighted across successful queries
  evidenceSufficient?: boolean;
  visibilityConfidence?: ConfidenceLevel;
}

export type SerpQueryKind = 'brand' | 'brand_category' | 'intent' | 'user';

export interface GeneratedQuery {
  query: string;
  kind: SerpQueryKind;
  source: string; // explanation of where the query came from
}

export type VisibilityTier =
  | 'Excellent'
  | 'Strong'
  | 'Moderate'
  | 'Limited'
  | 'Weak'
  | 'Not observed'
  | 'Unknown';

export interface QueryVisibilityResult {
  query: string;
  kind: SerpQueryKind;
  ok: boolean;                 // SERP retrieved successfully with enough results
  resultsCount: number;
  exactPosition: number | null;
  domainPosition: number | null;
  relevantPosition: number | null;
  tier: VisibilityTier;
  provider: 'tinyfish' | 'bing' | 'none';
  topResults: CompetitorSnippet[];
}

export interface FinalAuditReport {
  targetContext: TargetContext;
  auditTimestamp: string;
  isPartialAudit: boolean;
  partialAuditReason?: string;
  overallScore: number; // 0 to 100 — always equals sum(category scores) === 100 - sum(finding deductions)
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
    headings: PageHeading[];
    structuredDataTypes: string[];
    totalImages: number;
    imagesWithAltCount?: number;
    imagesWithEmptyAltCount?: number;
    imagesWithMissingAltCount?: number;
    missingAltCount: number;
    robotsDirectives: string | null;
    wordCount: number;
    totalWordCount?: number;
    mainContentWordCount?: number;
    hasHttps: boolean;
    pageType?: PageType;
    microdataTypes?: string[];
    rdfaTypes?: string[];
  };
  /** Multi-query SERP evidence used for Search Visibility (optional). */
  searchEvidence?: {
    queries: QueryVisibilityResult[];
    visibilityTier: VisibilityTier;
    evidenceSufficient: boolean;
  };
}
