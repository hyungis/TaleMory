---
name: structuring-kotlin-ddd-code
description: Use when reviewing, designing, or refactoring Kotlin backend or Spring Boot code where package boundaries, DDD alignment, file size, service responsibilities, controller thinness, or pattern choice are unclear.
---

# Structuring Kotlin DDD Code

## Overview

Use this skill to keep Kotlin backend code easy to navigate, easy to test, and easy to extend.

Default to pragmatic DDD:
- organize by domain or feature first
- keep boundaries clear
- keep files and classes small enough to scan quickly
- introduce patterns only when they solve a real problem

This skill is for production Kotlin server code, not textbook-perfect architecture.

## When to Use

Use this skill when the task includes:
- designing package structure for a Kotlin backend
- reviewing Kotlin or Spring Boot code for responsibility boundaries
- refactoring large files, services, controllers, or domain logic
- splitting code by use case, layer, or business responsibility
- deciding whether a pattern such as Strategy, Factory, Policy, or Adapter is justified
- improving maintainability without changing business behavior

Do not use this skill for:
- frontend-only Kotlin UI structure
- algorithm-only problems with no architectural concern
- formatting-only requests with no structural impact

## Fast Decision Rules

Prefer these defaults unless the codebase gives a strong reason not to:
- group packages by bounded context or feature before technical layer
- keep controllers focused on HTTP concerns only
- keep business decisions inside domain or application layers
- keep framework and persistence details out of domain
- split one large service into use-case-focused services when responsibilities diverge
- keep code together when splitting would make navigation worse

## Project-Specific Spring Conventions

When working in this project, prefer these conventions unless the user explicitly overrides them.

### Controller method naming

Controller methods should use a domain name plus action suffix.

- `orderList()` for list reads
- `orderDetails()` for single-item reads
- `orderAdd()` for creates
- `orderModify()` for updates
- `orderRemove()` for deletes

Apply the same pattern to other domains, for example `jobAdd()` and `jobDetails()`.

### Service method naming

Service methods should use action prefixes.

- `findOrder()` for reads
- `addOrder()` for creates
- `modifyOrder()` for updates
- `removeOrder()` for deletes

Apply the same pattern to other domains, for example `findJob()` and `addJob()`.

### Package and DTO placement

- Package by feature first, then by purpose.
- Controllers should handle request mapping, service calls, and exception translation only.
- Keep business logic out of controllers.
- Keep classes and methods small and single-purpose.
- Keep presentation request/response DTOs in `presentation`.
- Keep application input/output DTOs in `application/dto`.
- In this project, persistence entities may live in `entity` when the team wants them separated from pure domain types.
- In this project, shared enums and similar cross-layer meaning types may live in `model` when they are reused by presentation, application, messaging, and entity together.

Current preferred jobs example:

```text
domain/jobs
  application
    JobService.kt
    dto/
  entity
    Job.kt
  model
    JobType.kt
    JobStatus.kt
  infrastructure
    repository/
      JobRepository.kt
    messaging/
      JobStreamPublisher.kt
      RedisJobStreamPublisher.kt
  presentation
    JobController.kt
    JobRequests.kt
    JobResponse.kt
```

### Repository naming in this project

- If the project directly uses Spring Data JPA without a separate domain repository port, prefer neutral names like `JobRepository`.
- If Querydsl reads are split out, prefer names like `JobQueryRepository`.
- If a technology has a strong ecosystem convention, use that convention for concrete infrastructure types, such as `UserMapper` for MyBatis or `UserJdbcDao` for JdbcTemplate.

### Service class naming

Avoid broad service names like `OrderService` when they become dumping grounds.
If a single service stays small and cohesive, it is acceptable.
If responsibilities start to diverge, split by use case such as `OrderRegisterService` or `OrderStatusService`.

## Review and Refactor Workflow

Follow this order:
1. Identify the bounded context, feature, or use case.
2. Check whether the package layout is domain-first or has drifted into generic technical buckets.
3. Check whether presentation, application, domain, and infrastructure responsibilities are mixed.
4. Find oversized files, classes, and functions.
5. Split by responsibility, not by arbitrary line count.
6. Introduce a pattern only if it clearly improves clarity, testability, or change isolation.
7. Preserve business behavior unless the user explicitly asks for behavioral change.

## Default Package Shape

Start with a feature-first structure like this:

```text
com.example.project
  common
    config
    exception
    response
    util
  domain
    order
      application
      domain
      entity
      model
      infrastructure
      presentation
```

Interpret the layers like this:
- `presentation`: controllers, request parsing, response mapping, HTTP concerns
- `application`: use cases, orchestration, transaction boundaries, ports
- `domain`: pure business concepts and rules
- `entity`: persistence entities when the project chooses to separate them from pure domain types
- `model`: shared enums and cross-layer meaning types
- `infrastructure`: JPA implementations, external clients, messaging, persistence details

Add deeper sub-packages only when the feature is large enough to justify them.

## Boundary Rules

Treat these as hard defaults:
- do not put business logic in controllers
- do not put framework or persistence details in domain
- repository abstractions may live in domain or application when that fits the model
- repository implementations belong in infrastructure
- prefer use-case-oriented services over one generic service class
- do not move domain knowledge into infrastructure to make wiring easier

## Split Triggers

Refactor when you see any of these:
- one class mixes controller, orchestration, and business logic
- one service contains unrelated use cases
- one file mixes DTOs, mappers, policies, and persistence code
- one function contains multiple independent decisions
- one class becomes a dumping ground for "misc" behavior
- one file contains several concepts that change for different reasons

Common split targets:
- request or response DTO
- mapper
- validator
- policy
- use case
- repository implementation
- external client
- domain calculation logic

Do not split mechanically just to hit a line-count target.

## Pattern Heuristics

Use a pattern only when it gives a clear payoff.

Patterns that are often useful:
- `Factory`: complex aggregate or domain object creation
- `Strategy`: interchangeable business rules or algorithms
- `Specification`: composable rule checks
- `Policy`: large or evolving decision logic
- `Adapter`: external system integration
- `Facade`: simplifying a noisy subsystem
- `Mapper`: non-trivial DTO, entity, and domain conversions
- `Builder`: object construction that is becoming hard to read

Avoid:
- premature abstraction
- interface extraction without multiple meaningful implementations
- patterns added to trivial CRUD flows
- extra layers that do not protect any boundary or simplify any change

## Kotlin Conventions

Follow official Kotlin conventions unless the project already uses a different house style.

Prefer:
- clear naming over clever naming
- `val` over `var` unless mutation is required
- safe null handling
- small focused files and classes
- `data class` when it matches the model
- extension functions only when ownership and readability stay clear
- expression bodies only when they improve readability

Avoid:
- giant service classes
- giant utility files
- deeply nested conditionals when extraction would clarify intent
- long scope-function chains that hide business meaning

## Response Shape

When reviewing code, return:
- the main structural problems
- why each problem matters
- the recommended package or file structure
- a practical refactoring path

When refactoring code, return:
- the target package tree if structure changes
- the file split plan
- production-friendly rewritten code

When designing structure from scratch, return:
- the package tree
- the responsibility of each package
- class split recommendations
- pattern recommendations only where clearly justified

## Core Principle

Choose the structure that makes responsibilities clearer, files easier to scan, and future changes safer.

If two choices are both valid, prefer the simpler one.

## References

Read these only when needed:
- `reference/package-templates.md`
- `reference/pattern-guidelines.md`
- `reference/kotlin-convention-checklist.md`
- `reference/spring-boot-ddd-examples.md`
