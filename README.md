# 🔍 AI Search Lens — AI-Powered SEO Page Auditor

**AI Search Lens** is an AI-powered SEO auditing tool designed to analyze webpages and help developers, website owners, and marketers understand how well their pages can be discovered, understood, and indexed by search engines and AI-powered crawlers.

It goes beyond basic SEO checks by combining technical analysis, content evaluation, search visibility signals, and actionable recommendations in one place.

## 🚀 Key Features

- **Comprehensive SEO Audits** — Analyze individual webpages using their exact URLs.
- **SEO Scoring Engine** — Evaluate page quality across multiple SEO-related dimensions.
- **Technical SEO Analysis** — Inspect page titles, meta descriptions, headings, canonical URLs, images, structured data, and other important SEO signals.
- **Content & Intent Analysis** — Evaluate page content, structure, relevance, and search intent.
- **AI Readability Analysis** — Assess how clearly webpage content is structured for AI systems and automated crawlers.
- **Search Visibility Analysis** — Query search results and evaluate whether the target website or page appears in relevant results.
- **Evidence-Based Reporting** — Use extracted webpage evidence to support audit findings instead of relying entirely on assumptions.
- **Prioritized Recommendations** — Generate actionable improvements to help users focus on the most important SEO issues first.
- **Competitor & Search Result Insights** — Examine relevant search results and identify potential competing pages.
- **Robust Audit Handling** — Support partial results, fallback behavior, redirect analysis, and unverified search states.
- **AI Integration** — Integrate AI-powered analysis into the auditing workflow.

## 🧠 How It Works

1. **Enter a URL:** Provide the exact webpage you want to audit.
2. **Fetch Page Evidence:** Retrieve webpage content and rendered HTML where supported.
3. **Extract SEO Signals:** Analyze metadata, headings, content, images, and structured data.
4. **Evaluate Search Visibility:** Query search results and compare them with the target URL or domain.
5. **Calculate Scores:** Process the collected evidence through the relevant scoring engines.
6. **Generate Recommendations:** Identify issues and suggest prioritized improvements.
7. **Review Results:** Use the audit report to understand strengths, weaknesses, and next steps.

## 🛠️ Technology Stack

The project uses a TypeScript-based architecture with a Next.js application layer.

- **Language:** TypeScript
- **Framework:** Next.js
- **SEO Analysis:** Custom SEO scoring and analysis engines
- **AI Integration:**  TinyFish integrations
- **Search Analysis:** TinyFish-powered search visibility checks
- **Testing:** Automated tests for audit behavior and reliability
- **Runtime / Tooling:** Bun, where configured by the project

*Note: The exact dependencies and supported integrations may vary with the current repository configuration.*

## 📊 Audit Capabilities

AI Search Lens focuses on multiple aspects of webpage quality:

| Audit Area          | What It Evaluates                                                   |
| ------------------- | ------------------------------------------------------------------- |
| Technical SEO       | Metadata, headings, canonical signals, and other technical elements |
| Content & Intent    | Content structure, relevance, and search intent                     |
| AI Readability      | Content clarity and structure for AI-oriented discovery             |
| Search Visibility   | Search-result presence and target URL/domain matching               |
| Evidence Extraction | Information collected from the target webpage                       |
| Recommendations     | Prioritized actions based on identified issues                      |

## 🎯 Project Goals

The goal of AI Search Lens is to make SEO auditing more transparent, evidence-driven, and actionable.

Rather than simply presenting a score, the project aims to explain what was detected, why it matters, and what users can improve.

The long-term vision is to help websites improve their visibility across traditional search engines and emerging AI-powered discovery systems.

## 💻 Getting Started

### Prerequisites

- Node.js compatible with the project's dependencies
- Bun, if required by the current project configuration
- Git
- API credentials for integrations that require them

### Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ai-search-lens.git
cd ai-search-lens
```

Install dependencies using the package manager configured in the project:

```bash
bun install
```

If the repository is configured for npm instead, use:

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root and configure the API keys required by the integrations enabled in your application.

Example:

```env
TINYFISH_API_KEY=your_tinyfish_api_key
```

Use the actual variable names referenced by the source code. Never commit real API keys or other secrets to GitHub.

### Run Locally

Using Bun:

```bash
bun run dev
```

Or, if configured for npm:

```bash
npm run dev
```

Open the local URL displayed in your terminal to access the application.

## 🧪 Testing & Quality

The project includes tests for audit reliability and behavior. Before submitting changes, run the test and build commands defined in `package.json`.

Typical commands, when supported by the repository:

```bash
bun run test
bun run build
```

## 🔐 Security & Reliability

- Keep API keys on the server side.
- Validate and normalize submitted URLs.
- Handle failed requests and unavailable search results gracefully.
- Distinguish verified findings from partial or unverified results.
- Base recommendations on available evidence wherever possible.

## 🗺️ Future Direction

Potential areas for further development include:

- More comprehensive technical SEO checks.
- Improved AI-search visibility analysis.
- Deeper competitor analysis.
- More detailed evidence and recommendation explanations.
- Expanded automated testing and audit reliability.

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Submit a pull request describing your improvements.

## 📄 License

A license has not been specified in this README. Add the appropriate license before distributing the project under an open-source license.

---

**AI Search Lens — Understand your SEO. Improve your visibility.**

