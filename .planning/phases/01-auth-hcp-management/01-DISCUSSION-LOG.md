# Phase 1: Discussion Log

**Date:** 2026-05-07
**Phase:** Auth + HCP Management

## Areas Discussed

### Role Permissions
- **Q:** What are the exact roles and what can each do?
- **A (user):** Business is not a single role — Marketing, Advisory, and Speaker Program are separate business units that all do the same thing (submit requests). Compliance reviews FMV and runs debarment checks manually. Finance approves payment after Compliance approves.
- **A (user):** Business is a unified role tagged by department. Finance only sees engagements after Compliance approves. Finance handles payments outside the system.
- **Decision:** 3 roles (Business, Compliance, Finance). Business is unified with a department tag. Two-step approval: Compliance then Finance.

### HCP Profile Lifecycle
- **Q:** Store locally on lookup or fetch live each time?
- **A (user):** Store locally on lookup (recommended).
- **Q:** Who can look up and add HCPs?
- **A (user):** Business and Compliance.
- **Decision:** HCP stored in DB on first NPI lookup. Both Business and Compliance can add HCPs.

### Login Experience
- **Q:** Email + password, Google, or both?
- **A (user):** Email + password.
- **Decision:** Clerk email + password. No social login for v1.

### Debarment Check Flow
- **Q:** Can Business submit before debarment check is run?
- **A (user):** Yes — Compliance sees a warning.
- **Q:** What happens on a match?
- **A (user):** Compliance records a determination with rationale.
- **Decision:** Manual trigger only. Submissions allowed pre-check with warning. Match → Compliance reviews and records determination manually.

## Deferred Ideas
- SAML/SSO — future consideration
- Automated debarment re-checks — v2
- Full audit log — v2
