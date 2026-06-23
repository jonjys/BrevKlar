# Brevklar

**AI som översätter myndighetsbrev, juridiska dokument och viktig kommunikation till vanlig svenska – med handlingsplan, deadlines och riskbedömning.**

Detta repo innehåller **backend-MVP:n** (Fas 1) byggd enligt de tre första
tekniska stegen i blueprinten:

1. **Datamodell** – hur ett `Document` ser ut (metadata, OCR-text, AI-analys, risk-score) → `prisma/schema.prisma`
2. **Prompt-engineering** – en extremt strikt system-prompt som tvingar AI:n att alltid svara i ett stabilt JSON-format → `src/ai/`
3. **BankID** – inloggning via svensk e-legitimation som "trust-moat" → `src/auth/`

---

## Tech stack

| Lager | Val |
|------|-----|
| Backend | NestJS + TypeScript |
| Databas | PostgreSQL + Prisma |
| AI | Claude (Anthropic SDK), strikt JSON-output |
| Auth | BankID (RP API v6) + JWT |
| Lagring | Filsystem lokalt → S3/Supabase i produktion |

Frontend (React Native + Expo) byggs i ett separat steg och pratar med detta API.

---

## Arkitektur – analysflödet

Hela pipelinen från uppladdning till sparad analys:

```
Fil/text → OCR (steg 2) → AI-analys (steg 3–5) → Riskmotor → DB
           OcrService     AiService (Claude)      RiskService  Prisma
                          strikt JSON-kontrakt
```

- **`src/ai/analysis.contract.ts`** – ETT ställe för TypeScript-typen, JSON-schemat
  och runtime-valideringen av AI-svaret. System-prompten bor här. Glider aldrig isär.
- **`src/ai/ai.service.ts`** – anropar Claude och tvingar fram strukturerad JSON.
  Saknas `ANTHROPIC_API_KEY` används en **heuristisk fallback** så att hela
  flödet går att köra och testa lokalt utan extern tjänst.
- **`src/risk/risk.service.ts`** – AI Riskmotor. AI:n föreslår delrisker, men den
  slutgiltiga 0–100-poängen sätts **deterministiskt** här (en nära deadline drar
  alltid upp risken). Det gör risknivån stabil och förklarbar.
- **`src/auth/`** – BankID-flöde (`start` → `collect`) + JWT. Mock-läge för utveckling.
- **`src/feedback/`** – Human-in-the-loop: "Håller du med om tolkningen?" → mänsklig
  granskning → Golden Dataset.

---

## Datamodell (kärnan)

`Document` → `Analysis` (1:1) → `Deadline[]`, `Feedback[]`, samlade i `Case` (Brevhistorik).
Se `prisma/schema.prisma`. Höjdpunkter:

- **PII-maskering** – personnummer lagras aldrig i klartext, bara som `personalNumberHash`.
- **Trust Layer** – varje `Analysis` bär `confidenceScore`, `uncertainties`,
  `sourceReferences` och `needsHumanReview`.
- **Moat-data** – `documentType`, `Case`, `riskBreakdown` och korrigerad feedback
  byggs upp för varje analyserat dokument.

---

## Kom igång

```bash
# 1. Installera
npm install

# 2. Konfigurera
cp .env.example .env
#   - Sätt DATABASE_URL till din PostgreSQL.
#   - ANTHROPIC_API_KEY är valfritt (utan den körs heuristisk fallback).
#   - BANKID_MOCK_ENABLED=true för att testa inloggning utan certifikat.

# 3. Databas
npm run prisma:migrate   # skapar tabeller
npm run seed             # skapar en REVIEWER-användare

# 4. Kör
npm run start:dev        # http://localhost:3000

# Tester (riskmotor + AI-kontrakt, kräver ingen DB)
npm test
```

---

## API – snabb rundtur

```bash
# Hälsa + publik transparens-dashboard
curl localhost:3000/health
curl localhost:3000/stats

# 1. Logga in med BankID (mock-läge)
ORDER=$(curl -s -XPOST localhost:3000/auth/bankid/start \
  -H 'content-type: application/json' -d '{}' | jq -r .orderRef)
TOKEN=$(curl -s -XPOST localhost:3000/auth/bankid/collect \
  -H 'content-type: application/json' -d "{\"orderRef\":\"$ORDER\"}" | jq -r .session.token)

# 2. Analysera ett brev (text direkt, hoppar OCR)
curl -XPOST localhost:3000/documents/text \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"text":"Skatteverket. Du ska betala 4 200 kr senast 2026-07-01. Dnr 12-345."}'

# 3. Lista dokument, tidslinje (kommande deadlines)
curl localhost:3000/documents          -H "authorization: Bearer $TOKEN"
curl localhost:3000/documents/timeline -H "authorization: Bearer $TOKEN"

# 4. Ge feedback på en analys ("Håller du med?")
curl -XPOST localhost:3000/feedback \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"analysisId":"<id>","agrees":false,"comment":"Beloppet stämmer inte"}'
```

| Metod & väg | Beskrivning |
|---|---|
| `POST /auth/bankid/start` | Starta BankID (mock: returnerar orderRef direkt) |
| `POST /auth/bankid/collect` | Polla → JWT + användare |
| `GET /auth/me` | Inloggad användare |
| `POST /documents` | Ladda upp fil (multipart `file`) → OCR → analys |
| `POST /documents/text` | Skicka in text direkt → analys |
| `GET /documents` | Lista med risk + öppna deadlines |
| `GET /documents/timeline` | AI Tidslinje – kommande deadlines |
| `GET /documents/:id` | Ett dokument + full analys |
| `POST /documents/:id/analyze` | Kör om analysen |
| `POST /documents/:id/responses` | AI Svarsgenerator – skapa svarsutkast (`type`: FORMAL_REPLY / APPEAL / COMPLETION_REQUEST / EXTENSION_REQUEST / INFO_REQUEST) |
| `GET /documents/:id/responses` | Lista svarsutkast för ett dokument |
| `GET /responses/:id` | Hämta ett enskilt svarsutkast |
| `POST /feedback` | "Håller du med om tolkningen?" |
| `GET /feedback/review-queue` | Granskningskö (REVIEWER/ADMIN) |
| `POST /feedback/:id/review` | Expert rättar → Golden Dataset |
| `GET /stats` | Publik transparens-dashboard |
| `GET /cron/reminders` | Vercel Cron – skicka deadline-påminnelser (kräver `CRON_SECRET`) |
| `POST /cron/reminders` | Manuell trigger av påminnelse-svepet (kräver `CRON_SECRET`) |

Cron-endpointen skyddas av `Authorization: Bearer <CRON_SECRET>`. Lägg till `CRON_SECRET=<valfri-hemlighet>` i Vercel-miljön – saknas den är endpointen stängd.

---

## Status & nästa steg

**Byggt nu (Fas 1-kärna + Fas 2):** datamodell, strikt AI-kontrakt + analysmotor,
riskmotor, BankID-auth, dokument-pipeline, AI Tidslinje, **AI Svarsgenerator**,
feedback-loop, transparens-dashboard, freemium-kvot, **Dokumentövervakning**
(Vercel Cron + deadline-påminnelser), enhetstester.

**Implementeras härnäst:**

- **Riktig OCR** – `OcrService` är en stub; koppla in AWS Textract / Google Vision
  för bild & PDF (steg 2).
- **Strukturerade outputs** – `AiService` skickar redan `output_config.format`
  (JSON-schema) men har också textparsning som skydd för äldre SDK-versioner.
- **Kivra-integration** – vidarebeforda/importera PDF:er direkt.
- **E-post/push-påminnelser** – `NotificationService` loggar nu; koppla Postmark/SES för riktiga utskick.
- **Produktions-BankID** – byt mock mot mTLS mot `BANKID_API_URL`.
