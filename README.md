# SOA One

**Enterprise Business Rules Platform**

A modern, web-based business rules engine that replaces legacy Oracle SOA/BPM rules management. Build, test, deploy, and monitor business rules through a visual interface — no code required.

## Features

- **Visual Rule Designer** — IF/THEN/ELSE rule builder with drag-and-drop conditions and actions
- **Decision Tables** — Spreadsheet-style rule grids for complex multi-condition logic
- **Data Model Editor** — Define the structure of facts your rules evaluate
- **Test Sandbox** — Test rules against sample data instantly, see which rules fire and why
- **Version Control** — Publish, rollback, and compare rule set versions
- **REST API** — Every published rule set gets a REST endpoint for external integration
- **GraphQL API** — Full query and mutation support for all platform operations
- **Message Queue** — Async rule execution with job tracking and webhook callbacks
- **Monitoring Dashboard** — Execution stats, success rates, latency, and error tracking
- **Docker Deployment** — One command to deploy anywhere (on-prem, cloud, hybrid)

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Initialize the database
npm run db:push

# Seed with demo data
npm run db:seed

# Start all services (engine + server + client)
npm run dev
```

- **Frontend:** http://localhost:3000
- **REST API:** http://localhost:4000/api/v1
- **GraphQL:** http://localhost:4000/graphql
- **Health Check:** http://localhost:4000/api/v1/health

### Production (Docker)

```bash
docker-compose up -d
```

- **Application:** http://localhost:3000
- **API:** http://localhost:4000

## Architecture

```
packages/
├── engine/   — Core rule evaluation library (zero dependencies)
├── server/   — REST + GraphQL + Message Queue backend (Express, Apollo, Prisma)
└── client/   — React frontend (Vite, Tailwind CSS, React Router)
```

## API Examples

### Execute Rules (REST)
```bash
curl -X POST http://localhost:4000/api/v1/execute/{ruleSetId} \
  -H "Content-Type: application/json" \
  -d '{"applicant": {"age": 30, "creditScore": 780}}'
```

### Execute Rules (GraphQL)
```graphql
mutation {
  executeRuleSet(ruleSetId: "...", input: {applicant: {age: 30}}) {
    success
    output
    rulesFired
    executionTimeMs
  }
}
```

### Async Execution (Message Queue)
```bash
curl -X POST http://localhost:4000/api/v1/queue/execute \
  -H "Content-Type: application/json" \
  -d '{"ruleSetId": "...", "input": {...}, "callbackUrl": "https://..."}'
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| GraphQL | Apollo Server 4 |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma |
| Queue | Database-backed (dev) / Redis + BullMQ (prod) |
| Container | Docker, Docker Compose, nginx |

## Target Markets

- Government — eligibility determination, compliance rules
- Insurance — underwriting, claims processing, premium calculation
- Agriculture — subsidy eligibility, compliance rules

## License

Proprietary. All rights reserved.
