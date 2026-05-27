# Production Readiness

This application is production-ready as a single-site, browser-based warehouse tool for labels, receiving, movements, shipping, packing, reports, and local data backup.

It is not yet production-ready as a secure multi-user warehouse management system until the backend items below are added.

## Ready Now

- Static GitHub Pages deployment with `next build`.
- TypeScript validation is enforced during build.
- Admin-managed users and permissions for the browser app.
- Browser-side salted PBKDF2 password hashing, password strength checks, session expiry, and login lockout.
- Receiving, stock movement, shipping, cycle count, locations, packing, reports, barcode labels, printer profiles, and PDF/ZPL label output.
- Safe local storage parsing so corrupted browser data does not crash pages.
- Admin export/import backup for warehouse data.
- Zebra label print flows for browser/PDF/USB and server-backed WiFi ZPL where a server runtime is available.

## Required Before Multi-User Production

- Replace localStorage data with a real database such as PostgreSQL, SQL Server, MySQL, or Firebase/Supabase.
- Replace browser-only authentication with server-side authentication, server-held password hashes, sessions, and role checks enforced on the server.
- Add audit logs for every inventory mutation, user change, printer action, and packing completion.
- Add barcode scanner workflows for SKU lookup, location scan validation, and pick/pack confirmation.
- Add server-side inventory transactions to prevent two operators from changing the same stock at the same time.
- Deploy WiFi Zebra printing through a server or local print agent. Static GitHub Pages cannot open raw TCP connections to printers.
- Add automated browser tests for receiving, moving, shipping, packing, backup import/export, and label PDF generation.

## Validation

Run:

```bash
npm run validate
```

This runs TypeScript checking and a production Next.js build.
