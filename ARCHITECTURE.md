# Project Architecture: Big Boss Archive

## [STABLE BASELINE - APRIL 2026]
**Status**: COMPLETE STABILITY REACHED.
- **Critical Fix**: The `SyntaxError` (unexpected `<` token) was permanently resolved by modifying the `vercel.json` routing configuration to explicitly exclude `/api/*` paths from SPA rewrites. This ensures that the Vercel edge correctly differentiates between API endpoints and static React routes.
- **Security Logic**: The system now operates under the **"Sovereign Dynamic Security System"**. This two-tier authorization model combines a hardcoded Sovereign Master (hadyfinianos@gmail.com) with dynamic administrators managed through the GitHub-hosted registry (`registry.json`).
- **Environment Parity**: Supabase initialization now dynamically reads environment variables. This ensures tokens are correctly verified whether running in AI Studio, locally, or on Vercel.
- **Invariant**: This version is the absolute reference point. No future updates should revert the routing logic or the dynamic authorization bridge.

## [INDEPENDENT TAB ARCHITECTURE - APRIL 2026]
**Status**: ENFORCED.
- **Route Sovereignty**: The Admin Panel (at `/admin`) is a **strictly independent route**. It must never be integrated as a conditional component or modal within the Home Page. This ensures that admin operations run in a clean environment, preventing state conflicts with the public archive.
- **Logic Isolation**: The system components for the Admin Panel are isolated within their own namespace (e.g., separate files/directories). Any "aesthetic" updates or theme changes to the public site must not bleed into or affect the functionality and stability of the Admin Panel's configuration logic.

## [VERCEL SYNC BRIDGE - APRIL 2026]
**Status**: ACTIVE.
- **Endpoint Integrity**: Every API route defined in `server.ts` MUST have a matching standalone handler in the `/api` directory (e.g., `api/data.ts`) to ensure Vercel production compatibility.
- **Security Parity**: Security logic MUST be identical between `server.ts` and `/api/*.ts` handlers, using the Sovereign Master list and the GitHub-hosted registry.
- **Type Standard**: API handlers use standard Node.js `http` types to ensure error-free builds across all environments.

## [DYNAMIC THEME & PRIVACY - APRIL 2026]
**Status**: ACTIVE.
- **Dynamic Theme System**: Implemented `DynamicTheme.tsx` which injects a `<style>` block based on configuration in `registry.json`. It bridges the gap between stored hex codes and CSS variables, overriding global Tailwind classes safely.
- **Privacy Hardening**: Removed explicit user `displayName` from the Admin Panel header to ensure Sovereign privacy. 
- **Contextual UI**: The Admin Panel now dynamically adjusts its main title ("لوحة التحكم" vs "لوحة التحكم السيادية") based on the active `viewMode` (General Admins vs Sovereign Chamber).
- **Activity Monitor (Sovereign Only)**: Implemented a Supabase-backed Activity Monitor in the Sovereign Chamber. It logs all create/delete/update actions with 30-day auto-eviction. Only the Sovereign Master can access and manage these logs.

This document defines the structural integrity and logic of the "Big Boss" project, detailing the connections between the Frontend, Backend, GitHub, and Firebase.

## 1. System Overview
The application is a sovereign digital archive built for managing and displaying categorical documents (PDFs). It uses a "Headless Git" architecture where GitHub acts as the primary database and file storage, while Supabase handles user authentication.

## 2. Core Components

### A. Frontend (src/)
- **Framework**: React 19 + Vite + TypeScript.
- **Styling**: Tailwind CSS + Motion (for animations).
- **Theming**: Dynamic CSS-in-JS via `DynamicTheme.tsx` triggered by `registry.json`.
- **State Management**: React `useState` and `useMemo` for data filtering and display logic.
- **Search System**: Enhanced search logic with Arabic text normalization (handling alif, teh marbuta, and yeh variations). Implemented prioritization where document titles are searched first, followed by descriptions, with title matches appearing at the top of results.
- **Entry Point**: `src/main.tsx` initializes the app, and `src/App.tsx` handles routing and core layout.
- **Services**: `src/services/githubService.ts` acts as the bridge between the UI and the backend API.

### B. Backend / Bridge (server.ts & api/)
- **Runtime**: Node.js with Express.
- **Development**: Runs via `tsx server.ts`.
- **Production (Vercel)**: Uses `api/upload.ts` for serverless functionality and `vercel.json` for SPA routing.
- **Security**: 
    - **Supabase Auth SDK**: Used to verify `Authorization: Bearer <JWT_TOKEN>` headers sent from the frontend.
    - **Admin Tiers**: 
        - **Level 1 (Sovereign)**: Hardcoded Master Admins in `server.ts` and `src/lib/supabase.ts` (Super Admins).
        - **Level 2 (Dynamic)**: Admin list stored in the `admins` array within `registry.json` on GitHub. Managed via the "Sovereign Chamber" in the Admin Panel.

### C. Storage & Database (GitHub)
- **Data (JSON)**: All site configurations, categories, and article metadata are stored in `registry.json` (defined by `GITHUB_REGISTRY_PATH`).
- **Files (PDF/Assets)**: Media files are committed directly to the repository under `public/archive` (defined by `GITHUB_ARCHIVE_PATH`).
- **Access**: Managed via `Octokit` using a GitHub Personal Access Token (`GITHUB_TOKEN`).

## 3. Data Flow

### Read Operation (Public)
1. User visits the site.
2. Frontend calls `GET /api/data`.
3. Server fetches `registry.json` from GitHub via `Octokit`.
4. Data is returned to the UI and rendered.

### Write Operation (Admin Only)
1. Admin logs in via Google (Supabase Auth).
2. Admin performs an action (Upload PDF or Save Config).
3. Frontend sends request to `POST /api/upload` or `POST /api/data` with the Supabase JWT Token in the headers.
4. Server verifies the token using Supabase.
5. If authorized, Server commits the new file/data to GitHub.
6. GitHub triggers a deployment or simply stores the new state.

## 4. Environment Variables
The system relies on the following secrets configured in the environment:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Personal Access Token with `repo` permissions. | `ghp_...` |
| `GITHUB_OWNER` | GitHub account or organization name. | `hadyfinianos-sudo` |
| `GITHUB_REPO` | The repository name. | `big_boss` |
| `GITHUB_BRANCH` | The active branch for storage. | `main` |
| `GITHUB_REGISTRY_PATH` | Path to the JSON data file. | `registry.json` |
| `GITHUB_ARCHIVE_PATH` | Directory for uploaded PDFs. | `public/archive` |
| `GEMINI_API_KEY` | Used for future AI integration. | - |

## 6. Maintenance & Versioning
- **Milestone Tags**: 
    - `stable-v1` (2026-04-25): The first fully operational stable version with dynamic admins and routing fixes.
