# Security policy

This project is a browser front-end for the Technitium DNS Server REST API. It stores the
session token in the browser's `localStorage` and talks to your DNS server through a same-origin
`/api` reverse proxy, so the token is never sent cross-origin.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's private
[Report a vulnerability](https://github.com/maferick/technitium-console/security/advisories/new)
flow. Include the version/image tag, reproduction steps, and impact. You'll get a response as
soon as reasonably possible.

Vulnerabilities in DNS resolution, the API, or the server itself belong to the upstream
[Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer) project.

## Deployment notes

- Always serve this UI over HTTPS (terminate TLS at your reverse proxy).
- Restrict access (VPN, IP allow-list, or auth at the proxy) as you would for any DNS admin panel.
- The container only needs to reach your Technitium web service set via `TECHNITIUM_UPSTREAM`.
