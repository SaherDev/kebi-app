# AGENTS.md — Kebi AI Agents Configuration

This file documents AI agents configured for the Kebi project. Generated to support Claude Code and AI-assisted development workflows.

## Installed Agent Skills

### Frontend & Design Skills
- **web-design-guidelines** — UI/UX best practices and design system standards
- **vercel-react-best-practices** — React patterns and optimization techniques
- **vercel-composition-patterns** — Component composition and architectural patterns
- **clerk-nextjs-skills** — Clerk authentication integration with Next.js

### Backend & Framework Skills
- **nestjs-expert** — NestJS architecture, patterns, and best practices
- **nextjs16-skills** — Next.js 16 framework features and configuration

### Deployment & Infrastructure
- **deploy-to-vercel** — Vercel deployment workflows and optimization
- **use-railway** — Railway infrastructure management and deployment

## Project Context

Kebi is an AI-native place recommendation system. This configuration enables agents to understand:
- **Architecture**: Nx monorepo with Next.js (frontend), NestJS (backend), shared types
- **Tech Stack**: TypeScript, React, Tailwind CSS, PostgreSQL with pgvector
- **Deployment**: Vercel (frontend) + Railway (backend + AI service)
- **Internationalization**: RTL support for Hebrew, next-intl for i18n

## Agent Usage

These skills are available in Claude Code sessions within this project. Reference them when:
- Implementing frontend components and features
- Building NestJS API endpoints and services
- Deploying to Vercel or Railway
- Following design system standards
- Optimizing performance and architecture

## Configuration Files

- **CLAUDE.md** — Project standards, conventions, and workflow
- **docs/architecture.md** — System architecture and data flows
- **docs/decisions.md** — Architecture Decision Records (ADRs)
- **.claude/rules/** — Detailed standards for specific domains

## Notes

- Agent skills run with full permissions within Claude Code environments
- Review skill documentation at installation for latest updates
- Skills are symlinked from `.agents/skills/` for this project scope
