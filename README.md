# Kredent — Blockchain-Based Digital Degree Certificate Verification (SBT)

Final-year engineering project: verified institutions issue degree certificates digitally,
secured on-chain via Soulbound Tokens (SBTs). Students view/download their
certificates, admins issue and revoke them through a wallet-authenticated
portal, and employers verify any certificate instantly via QR code — no
login required.

This repo is split into two independent projects:

```
kredent 2/
  frontend/   React + Vite + Tailwind SPA — see frontend/README.md
  backend/    Spring Boot REST API (Java 17, JPA, Spring Security, JWT)
```

Each has its own dependencies, its own README, and can be run independently.

## Running locally

**Backend** (Spring Boot, port 8080 by default):

```bash
cd backend
mvn spring-boot:run
```

Requires `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` (Supabase Postgres) and, to
seed an admin account, `ADMIN_WALLET_ADDRESS`. See
`backend/src/main/resources/application.properties` for all supported env vars.

**Frontend** (Vite dev server, port 5173 by default):

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `frontend/.env` if the backend isn't running on
`http://localhost:8080`.

## Roadmap

- ✅ Auth & security foundation (JWT, BCrypt, wallet-based admin login)
- ✅ Frontend UI polish + design system (`frontend/src/components/ui`)
- ✅ Frontend/backend project structure separation
- ⬜ Certificate issuance + Supabase storage (PDFs)
- ⬜ Soulbound Token smart contract (Solidity + Hardhat + Polygon Amoy)
- ⬜ On-chain verification wired into the Verify Degree page

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Framer Motion |
| Backend | Spring Boot 3, Spring Security, JWT, Spring Data JPA |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (certificate PDFs) |
| Blockchain | Solidity, Hardhat, OpenZeppelin, Ethers.js, Polygon Amoy Testnet *(planned)* |


## Institution verification & demo registry

Kredent only lets an institution issue certificates after it has been verified against an
institutional registry. This repo ships a **simulated** registry (SQLite, `/registry` in the
frontend) for demonstration. It is **not** an official AICTE (or any regulator) portal and has no
connection to one.

**Flow:** college registers in the demo registry -> verifies its official email -> registry admin
approves -> on Kredent (`/admin/login`) the college enters its institutional ID -> registry details
are shown -> a 6-digit OTP is emailed to the registered HOI email -> OTP verified -> MetaMask wallet
connected and signed -> institution registered -> dashboard.

**Sample registry data** (seeded on first start; set `REGISTRY_SEED_SAMPLE_DATA=false` to disable):
`DEMO-1001`, `DEMO-1002`, `DEMO-1003` (APPROVED), `DEMO-2001` (PENDING), `DEMO-3001` (SUSPENDED);
sample college password `Demo@12345`. The registry admin comes from `REGISTRY_ADMIN_EMAIL` /
`REGISTRY_ADMIN_PASSWORD`; if the password is unset a random one is generated and printed **once**
in the backend log at first start. Sample HOI emails use the reserved `.example` domain, so set
`REGISTRY_DEMO_HOI_EMAIL=you@gmail.com` to receive demo OTPs (plus-addressed per college).

**Email (Gmail SMTP):** copy `backend/.env.example` to `backend/.env` (git-ignored) and set
`MAIL_PASSWORD` to a Gmail App Password. Never commit it. While it is empty the OTP endpoints
return `503 EMAIL_NOT_CONFIGURED`. OTPs are never returned by the API or logged.

**Production:** run `backend/docs/multi-institution-migration.sql` (schema is `validate` in prod).
