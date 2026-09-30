# Subscription Service

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-blue)
![Node.js](https://img.shields.io/badge/Node.js-22+-brightgreen)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![GraphQL](https://img.shields.io/badge/GraphQL-Apollo%20Server-pink)
![gRPC](https://img.shields.io/badge/gRPC-Proto%20Loader-lightgrey)

A NestJS microservice that manages SaaS subscription lifecycle. It exposes a **GraphQL API** for subscription CRUD operations, a **gRPC server** for internal service-to-service communication, and publishes domain events to **Apache Kafka** using Avro schemas.

## Architecture

The service follows a **hexagonal (ports & adapters)** architecture organised as
layered NestJS sub-modules under `src/subscription/`. The framework-free **domain**
sits at the centre; **application** use-cases depend only on **ports** (interfaces);
and **driving** adapters (GraphQL, gRPC) and **driven** adapters (TypeORM, Kafka)
plug in at the edges. The dependency direction always points inward — infrastructure
depends on the core, never the reverse.

```mermaid
graph LR
    Clients["GraphQL Clients"]
    Billing["Billing Service"]

    subgraph Interface["interface/ · Driving Adapters"]
        GQL["GraphQL Resolver<br/>/api/subscription :8081"]
        GRPC["gRPC Controller<br/>:50051"]
    end

    subgraph Application["application/ · Use-Cases"]
        UC["GetSubscription · GetUserActiveSubscriptions<br/>CreateSubscription · UpdateSubscription"]
        CB["Circuit Breaker<br/>(Opossum)"]
        PORTS{{"Ports<br/>RepositoryPort · ReadModelPort<br/>EventStorePort · SnapshotStorePort<br/>ProjectionPort · EventPublisherPort"}}
    end

    subgraph Domain["domain/ · Core"]
        DOM["Subscription (event-sourced)<br/>raises events + lifecycle rules"]
    end

    subgraph Infrastructure["infrastructure/ · Driven Adapters"]
        ESREPO["Event-Sourced Repository"]
        ESTORE["Event Store + Snapshots"]
        PROJ["Projection / Read Model<br/>TypeORM"]
        RELAY["Outbox Relay<br/>setInterval → Avro"]
        PROD["Kafka Avro Producer"]
    end

    PG[("PostgreSQL")]
    KAFKA["Kafka +<br/>Schema Registry"]
    OTEL["OpenTelemetry<br/>+ Winston"]

    Clients -->|GraphQL| GQL
    Billing -->|gRPC| GRPC

    GQL --> UC
    GRPC --> UC
    UC --> DOM
    UC -. guarded by .-> CB
    UC --> PORTS

    PORTS -. bound to .-> ESREPO
    PORTS -. bound to .-> PROJ
    PORTS -. bound to .-> PROD

    ESREPO --> ESTORE
    ESREPO --> PROJ
    ESTORE -->|events + snapshots| PG
    PROJ -->|CQRS read model| PG
    RELAY -->|polls unpublished| ESTORE
    RELAY --> PROD
    PROD -->|Avro Events| KAFKA
    UC -.->|trace + log| OTEL

    style Domain fill:#FFF7D6,stroke:#333,color:#333
    style Application fill:#E7F9F5,stroke:#333,color:#333
    style Interface fill:#FFE8DC,stroke:#333,color:#333
    style Infrastructure fill:#E9E6FF,stroke:#333,color:#333
    style DOM fill:#FFD700,stroke:#333,color:#333,stroke-width:2px
    style UC fill:#4ECDC4,stroke:#333,color:#fff,stroke-width:2px
    style PORTS fill:#95E1D3,stroke:#333,color:#333,stroke-width:2px
    style CB fill:#FFA07A,stroke:#333,color:#333,stroke-width:2px
    style GQL fill:#FF8B94,stroke:#333,color:#fff,stroke-width:2px
    style GRPC fill:#FF8B94,stroke:#333,color:#fff,stroke-width:2px
    style ESREPO fill:#6C63FF,stroke:#333,color:#fff,stroke-width:2px
    style ESTORE fill:#6C63FF,stroke:#333,color:#fff,stroke-width:2px
    style PROJ fill:#95E1D3,stroke:#333,color:#333,stroke-width:2px
    style RELAY fill:#FFA07A,stroke:#333,color:#333,stroke-width:2px
    style PROD fill:#FF6B6B,stroke:#333,color:#fff,stroke-width:2px
    style PG fill:#6C63FF,stroke:#333,color:#fff,stroke-width:2px
    style KAFKA fill:#FF6B6B,stroke:#333,color:#fff,stroke-width:2px
    style OTEL fill:#FFE66D,stroke:#333,color:#333,stroke-width:2px
```

### Event Sourcing (Subscription)

The `Subscription` aggregate is **event-sourced** — its state is the fold of an
append-only event stream rather than a mutable row:

- **Event store as source of truth.** Lifecycle changes raise typed events
  (`subscription.created`, `status-changed`, `cancellation-scheduled`, `canceled`,
  `renewed`, `updated`) appended to `subscription_event_store` (discriminated by
  `aggregate_type`). The store assigns each event its per-aggregate `sequence`; the
  unique `(aggregate_type, aggregate_id, sequence)` constraint is the
  **optimistic-concurrency** guard, replacing the old TypeORM `@VersionColumn`.
- **Snapshots** every _N_ events (`SUBSCRIPTION_SNAPSHOT_INTERVAL`, default 50)
  bound replay length.
- **CQRS read model.** The `subscriptions` table is now a **projection**, upserted
  in the same transaction as the append. Query use-cases read the projection and
  never replay events.
- **Transactional-outbox relay.** A lightweight `setInterval` poller
  (`SubscriptionEventRelay`) drains unpublished events to Kafka as Avro, marking
  them published only after the broker acks — removing the previous
  persist-then-publish dual write (where a failed publish on update was silently
  swallowed). The six granular events collapse onto the two existing topics
  (`subscription.created` / `subscription.updated`), so **downstream consumers such
  as billing are unaffected**. Each message is built from the aggregate state folded
  up to that event, so it reflects the world as of when the event happened.

```mermaid
flowchart TD
    CMD["Command<br/>create · update · cancel · renew"] --> AGG["Subscription aggregate<br/>raises event · version++"]
    AGG -->|pending events| SAVE["EventSourcedSubscriptionRepository.save<br/>single transaction"]

    SAVE -->|1 · append @ expected version| ES[("subscription_event_store<br/>append-only · unique aggregate,seq")]
    SAVE -->|2 · upsert| PROJ[("subscriptions projection<br/>CQRS read model")]
    SAVE -->|3 · boundary check| CHK{"crossed every-N<br/>snapshot boundary?"}
    CHK -->|yes| SNAP[("subscription_snapshot")]
    CHK -->|no| NOOP(["no snapshot"])

    LOAD["findById"] -->|newest snapshot| SNAP
    LOAD -->|events after snapshot version| ES
    SNAP --> FOLD["replay tail onto snapshot<br/>→ current Subscription"]
    ES --> FOLD

    RELAY["SubscriptionEventRelay<br/>setInterval"] -->|poll unpublished| ES
    RELAY -->|fold to state, publish Avro, mark published| KAFKA["Kafka · Schema Registry<br/>subscription.created / .updated"]

    QUERY["Query use-cases"] -->|reads, never replays| PROJ

    style ES fill:#6C63FF,stroke:#333,color:#fff
    style SNAP fill:#FFA07A,stroke:#333,color:#333
    style PROJ fill:#95E1D3,stroke:#333,color:#333
    style KAFKA fill:#FF6B6B,stroke:#333,color:#fff
    style CHK fill:#FFE66D,stroke:#333,color:#333
```

Schema for `subscription_event_store` / `subscription_snapshot` ships as TypeORM
migrations (`migrations/`), run via `pnpm run run-migrations`.

## Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js / TypeScript |
| Framework | NestJS 11 |
| API | GraphQL (Apollo Server 5) |
| Internal RPC | gRPC (Buf Registry fetch) |
| Database | PostgreSQL (TypeORM) |
| Messaging | Apache Kafka (KafkaJS + Confluent Schema Registry) |
| Schema | Avro |
| Resilience | Opossum circuit breaker |
| Observability | OpenTelemetry (traces + logs), Winston |
| Testing | Jest + Testcontainers |
| Package manager | pnpm |

## Features

- **GraphQL API** — create, update, and query subscriptions via `/api/subscription`
- **gRPC server** on port `50051` — exposes subscription data to billing-service
- **Kafka producer** — publishes `subscription.created` and `subscription.updated` events with Avro-encoded payloads to Confluent Schema Registry
- **Circuit breaker** — read and create use-cases wrap their repository calls with Opossum; falls back gracefully on failure
- **OpenTelemetry** — distributed tracing exported via OTLP HTTP; spans created per service operation
- **Database migrations** — TypeORM migrations managed via CLI
- **Health endpoint** — `GET /healthz/live`

## Project Structure

The subscription bounded context is organised as a hexagon under `src/subscription/`,
with each layer wired as its own NestJS module (`ApplicationModule`,
`InfrastructureModule`, `InterfaceModule`) composed by `SubscriptionModule`.

```
subscription-service/
├── src/
│   ├── subscription/                  # Subscription bounded context (the hexagon)
│   │   ├── domain/                    # Framework-free core
│   │   │   ├── subscription.ts        #   rich model: create/applyUpdate/cancel/renew
│   │   │   ├── subscription-status.enum.ts
│   │   │   └── subscription.errors.ts #   domain errors
│   │   ├── application/               # Use-cases + ports (the inside)
│   │   │   ├── use-cases/             #   Get / GetUserActive / Create / Update
│   │   │   ├── ports/                 #   repository + event-publisher interfaces + tokens
│   │   │   ├── dtos/                  #   use-case input contracts
│   │   │   ├── subscription-event.publisher.ts
│   │   │   ├── subscription.mapper.ts #   domain → event payloads
│   │   │   ├── support/               #   circuit-breaker interface
│   │   │   └── application.module.ts
│   │   ├── infrastructure/            # Driven adapters (implement the ports)
│   │   │   ├── persistence/           #   TypeORM entity, repository, ORM↔domain mapper
│   │   │   ├── messaging/             #   Kafka Avro event producer
│   │   │   ├── resilience/            #   Opossum circuit breaker
│   │   │   └── infrastructure.module.ts
│   │   ├── interface/                 # Driving adapters
│   │   │   ├── graphql/               #   resolver + GraphQL type
│   │   │   ├── grpc/                  #   controller + proto mapper
│   │   │   └── interface.module.ts
│   │   └── subscription.module.ts     # Composition root
│   ├── controller/                    # App-level health endpoint
│   ├── logger/                        # Winston logger
│   ├── schemas/                       # Avro schemas (.avsc) + GraphQL schema
│   ├── pb/                            # Generated gRPC stubs
│   ├── lib/                           # Shared logger + tracing helpers
│   ├── logger.module.ts              # Logger module
│   ├── app.module.ts                 # Root module
│   ├── tracing.ts                    # OpenTelemetry bootstrap
│   └── main.ts                       # Application entry point
├── migrations/                        # TypeORM migration files
└── test/                              # Integration, wiring, pact + e2e tests
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL
- Kafka + Confluent Schema Registry
- (Optional) OpenTelemetry Collector

### Environment Variables

Create a `.env` file in `subscription-service/`:

```env
PORT=8081
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=subscription_user
POSTGRES_PASSWORD=subscription_password
POSTGRES_DB=subscription_db
DB_POOL_MAX=20
DB_POOL_MIN=5
KAFKA_BROKERS=localhost:9092
SCHEMA_REGISTRY_URL=http://localhost:9094
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Event sourcing
SUBSCRIPTION_SNAPSHOT_INTERVAL=50
SUBSCRIPTION_EVENT_RELAY_INTERVAL_MS=1000
SUBSCRIPTION_EVENT_RELAY_BATCH=100
# SUBSCRIPTION_EVENT_RELAY_ENABLED=false   # disable the outbox relay (e.g. in tests)
```

### Install & Run

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm run-migrations

# Start in development mode
pnpm start:dev

# Start in production mode
pnpm start:prod
```

### Build

```bash
pnpm build
```

### Testing

```bash
# Unit + integration tests (requires Docker for Testcontainers)
pnpm test

# With coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

## API

### GraphQL

Playground available at `http://localhost:8081/api/subscription` (dev mode).

**Example — create a subscription:**

```graphql
mutation {
  createSubscription(input: {
    userId: "3f0e4f7a-1c2b-4d5e-8a90-1234567890ab"
    planId: "plan-pro"
  }) {
    id
    status
    planId
    currentPeriodStart
    currentPeriodEnd
  }
}
```

> `status` defaults to `ACTIVE` and the 30-day billing period
> (`currentPeriodStart` / `currentPeriodEnd`) is computed by the domain model.

### gRPC

The service implements the `SubscriptionService` defined in `src/proto/subscription.proto`. Billing-service connects to `host:50051` to fetch subscription details.

## Kafka Events

| Topic | Event | Trigger |
|---|---|---|
| `subscription.created` | `SubscriptionCreated` | New subscription created |
| `subscription.updated` | `SubscriptionUpdated` | Any subsequent lifecycle change (status, cancel, renew) |

Payloads are Avro-encoded. Schemas are registered in Confluent Schema Registry and stored in `src/schemas/`. Events are published by the **transactional-outbox relay** draining `subscription_event_store` (see [Event Sourcing](#event-sourcing-subscription)) — not directly from the use-cases — so publishing can no longer be lost by a failed post-commit send. The granular domain events map onto these two topics, so the contract downstream consumers (e.g. billing) depend on is unchanged.

## Docker

```bash
docker build -t subscription-service .
docker run -p 8081:8081 -p 50051:50051 --env-file .env subscription-service
```

## CI/CD

GitHub Actions workflows are in `.github/workflows/`:

- `subscription-service-ci.yml` — lint, test, build on push/PR
- `subscription-service-cd.yml` — build & push Docker image on merge to main
- `test.yml` — standalone test runner

## License

MIT
## Security & Guardrails

Container supply-chain guardrails run in CI and locally — see [`policy/README.md`](policy/README.md).

- **Dockerfile Policy as Code** — OPA/Rego via `conftest` (`policy/docker/`): hard-gates unpinned/`:latest` base images, `USER root` final stages, and `ADD <remote-url>`; warns on missing `USER`/`HEALTHCHECK`, tag-not-digest, `apt` without `--no-install-recommends`, etc.
- **Checkov** — Dockerfile + secret scanning (baseline/report mode).
- **Trivy** — image scanning **before push** in the build pipeline (fail-closed on fixable CRITICAL/HIGH), plus `trivy fs` (deps) and `trivy config` (misconfig) on PRs. Complements source-level scanning (e.g. SonarQube).

```bash
./scripts/guardrails.sh   # conftest + checkov + trivy (skips tools not installed)
```

CI: [`.github/workflows/security.yml`](.github/workflows/security.yml) (PR gate) + the Trivy image scan wired into the build workflow.
