README — Spreadsheet Cleaner & Rule-Aware Exporter

Live app: add your deployed link here, e.g., https://spreadsheet-alchemist.vercel.app/
Private demo link here, e.g., https://www.loom.com/share/845d2a92646c4a4caede7abec4bb901e?sid=56a84737-ceaf-421f-b7dd-6d7d50552416

Overview

This project is an online helper that tidies messy spreadsheets for non-technical users. You upload raw CSV or Excel files, the system’s AI quickly inspects the data, flags issues with clear human-readable warnings, lets you search rows with natural language (for example “rooms with projector and capacity over 50”), and then fix problems directly inside the table with a single click. If you need rules, you type them in plain English and the AI converts those sentences into structured validation and allocation settings. A simple validator panel explains what’s wrong and how to fix it, while priority sliders let you tune trade-offs such as minimizing cost or finishing work quickly and see the plan update instantly. When all checks pass, you export a clean CSV plus a companion rules file that downstream allocation tools can consume. In short, you drop in messy data, interact with it using AI features, auto-clean and validate it, define rules in natural language, and download a neat package ready for the next steps.

Deployed link

Place your production URL above. The deployed instance runs the same code as this repository and is configured with safe defaults so you can try the full flow end-to-end: upload, review warnings, search with natural language, one-click fixes, rules in plain English, validation panel, priority sliders, and export.

Private demo video

Add an unlisted YouTube link above. In the video, walk through a realistic spreadsheet, show the initial upload, the AI validation messages, a few natural-language searches, a couple of one-click fixes, writing rules in English and watching them turn into structured settings, adjusting sliders to prioritize cost versus speed, and finally exporting the clean CSV and the rules JSON. Briefly explain the tech choices, what runs on the client versus the server, and how the AI prompts are grounded in column metadata to keep responses reliable.

Features and user flow

The upload accepts CSV and Excel (XLSX) and infers column types, required fields, unique keys, and basic constraints from headers and sample values. The validator panel summarizes issues such as missing required fields, invalid data types, duplicate identifiers, out-of-range values, and cross-column inconsistencies, and each item offers a one-click fix when it is safe to automate. Natural-language search uses a lightweight semantic layer to translate user intent into structured filters over the in-memory dataset so people can “ask the table” without writing queries. The rules composer accepts sentences like “room must have projector for events tagged workshop” or “don’t schedule more than two bookings per room per day” and compiles them into machine-readable rules the validator and exporter use. The priorities section exposes sliders that weight objectives such as cost, duration, and utilization, and the planner applies these weights when proposing fixes or allocations. The export button produces a clean CSV reflecting all approved fixes and a rules file (JSON or YAML) that downstream systems can consume identically.

How it works under the hood

The frontend renders a virtualized spreadsheet grid for performance, tracks edits locally, and shows inline warnings sourced from the validation engine. The natural-language layer extracts entities and constraints from the user prompt, maps them to known column names and types, and generates a safe filter expression rather than executing free-form code. The rule engine parses plain-English sentences into a small domain specific intermediate form, validates references against the current schema, and persists compiled rules alongside the dataset so the validator and exporter stay consistent. The backend provides file ingestion, schema inference, AI assistance, long-running validation jobs, and export packaging; it never stores user data longer than a configurable retention window. The AI components are grounded with column metadata and small, auditable prompts to avoid hallucinations and include a deterministic fallback for critical checks.

Tech stack

The frontend is built with React and TypeScript using a modern table component and Tailwind CSS with shadcn/ui for accessible primitives, and it uses a small state store to keep grid edits fast and predictable. The backend is implemented with Node or Python (choose one in your implementation), offers REST endpoints for uploads, validations, and exports, and optionally exposes GraphQL for richer clients. File parsing is handled with robust CSV and XLSX libraries, and validation uses a rule engine that combines declarative schema checks with compiled constraints. The AI layer can connect to providers such as OpenAI or local models behind a common interface; embeddings or simple keyword maps help with column name synonyms. Storage uses PostgreSQL for rules and job metadata, and temporary object storage for file blobs; background tasks run via a queue for heavy validations. Deployment targets AWS with S3 or CloudFront for assets, a containerized API, and environment-based configuration.

Local setup

Clone the repository, install dependencies in both client and server folders, add a .env file with your AI provider key and storage paths, start the backend, and then start the frontend. For example, you can run the server on port 4000 and the client on port 5173, then open the client URL and upload a sample file from the samples directory to verify the whole path from upload to export.

Configuration and environment

Environment variables include an AI API key, an allow-list for file sizes and types, a retention period for uploaded files, a toggle to disable AI features for offline use, and an export format switch to choose between JSON and YAML rules. The defaults favor privacy and non-persistence.

Data model and rules file

The exported rules file includes schema definitions such as required fields and types, constraint rules compiled from English sentences, and objective weights from the priority sliders. Downstream tools can load the rules file to re-validate or enforce the same decisions made in the UI, making the hand-off predictable and auditable.

Accessibility, text, and tags

The UI uses semantic HTML tags for headings, sections, and tables, includes descriptive labels for form elements, and applies ARIA attributes where necessary so screen readers announce validation states and button intents. All text components, tags, badges, and helper messages are implemented with consistent typography and color tokens that meet contrast guidelines, and the validator panel summarizes issues in plain language before any technical detail.

Security and privacy

Uploaded files are processed in memory where possible or stored in a temporary, expiring bucket. AI prompts are stripped of sensitive values and sent with only the minimum necessary context such as column names and example shapes. Exports are generated on demand and removed after a short grace period. No data is used for model training.

Roadmap

Planned improvements include collaborative editing with presence indicators, versioned rule sets with diffs, custom validators per column type, a template gallery for common schemas, and an offline desktop build for sensitive environments.

Contact

If you have questions about deployments, the video walkthrough, or integrations with downstream allocation tools, open an issue in the repository or reach out via the email listed in the project metadata.