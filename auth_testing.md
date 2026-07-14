# Auth Testing Playbook

## Endpoints
- POST /api/auth/register (creates a new org + user, returns user, sets httpOnly cookies)
- POST /api/auth/login    (sets httpOnly cookies, returns user)
- POST /api/auth/logout   (clears cookies)
- GET  /api/auth/me       (returns current user, requires cookies)

## Test flow
1. Login as seeded admin: admin@sentinel.ai / Admin@2026
2. Verify /api/auth/me returns user with org_id
3. Register a new user (auto-creates org)
4. Verify tenant isolation: user A cannot see user B's agents/policies

## Notes
- Cookies are httpOnly. Fallback: Authorization: Bearer token also supported.
- Frontend uses withCredentials: true on axios.
