# Pattern Guidelines

Use patterns only when they reduce coupling, improve testability, or clarify responsibility.
Do not add patterns for decoration.

## General rules

Prefer simple code when:
- there is only one straightforward flow
- behavior variation is unlikely
- the abstraction would add more files than value

Introduce a pattern when:
- a responsibility is clearly overloaded
- variation already exists or is very likely
- repeated creation or decision logic is getting hard to read
- external dependencies are leaking into business code

Do not:
- force patterns into simple CRUD
- extract interfaces with no real boundary
- introduce indirection without a clear payoff
- name classes after patterns unless the role is genuine

## Factory

Use when:
- domain object creation has multiple rules
- object construction must enforce invariants
- aggregate creation logic is complex or repeated

Good signals:
- constructors are becoming hard to read
- creation requires validation or derived values
- multiple callers repeat the same creation sequence

Avoid when:
- a normal constructor or companion object is enough
- creation is trivial
- there is no repeated or complex creation logic

Good fit:
- creating an Order aggregate with validated items, derived totals, and initial status
- creating a TravelPlan with validated destination, budget, and schedule rules

## Strategy

Use when:
- there are multiple interchangeable algorithms
- business rules vary by type, country, provider, or mode
- condition branches keep growing for the same concept

Good signals:
- long if or when blocks based on type
- similar methods differ only by policy variant
- new variants are added regularly

Avoid when:
- there are only one or two tiny branches
- variation is unlikely to grow
- a simple conditional is clearer than multiple classes

Good fit:
- discount calculation by membership type
- exchange rate source selection
- recommendation scoring modes by user preference

## Specification

Use when:
- rule checks need to be composed
- validation conditions are reused in multiple places
- the domain needs expressive business rule predicates

Good signals:
- repeated eligibility checks
- rule combinations like AND, OR, and NOT
- multiple use cases depend on the same conditions

Avoid when:
- the rule is simple and used once
- a normal function is clearer
- composition is not actually needed

Good fit:
- booking eligibility
- coupon applicability
- order cancellation conditions

## Policy

Use when:
- decision rules are part of domain behavior
- rules are too large for an entity method
- the rules may evolve independently

Good signals:
- domain decisions are becoming large and branching
- business decisions must be tested in isolation
- the rule has a meaningful business name

Avoid when:
- the logic is tiny and belongs naturally in the entity
- the separation creates unnecessary indirection
- there is no meaningful independent decision boundary

Good fit:
- refund policy
- recommendation score policy
- age-based pricing policy

## Adapter

Use when:
- integrating with external APIs or systems
- you need to isolate unstable or vendor-specific details
- application or domain should not depend on transport details

Good signals:
- external DTOs are appearing outside infrastructure
- retry, auth, or mapping details leak upward
- switching providers should be possible

Avoid when:
- no real external boundary exists
- wrapping a simple local class adds nothing
- the abstraction does not isolate any meaningful detail

Good fit:
- currency API adapter
- payment gateway adapter
- map or place API adapter

## Facade

Use when:
- a subsystem is too noisy for callers
- multiple technical calls should be hidden behind one clear entry point

Good signals:
- repeated orchestration of low-level helpers
- too many dependencies injected into one service
- callers should not know the subsystem steps

Avoid when:
- the facade only forwards one call
- it hides domain meaning instead of clarifying it
- the subsystem is already simple

Good fit:
- file upload subsystem
- multi-step content generation pipeline
- travel data aggregation flow

## Mapper

Use when:
- conversion between DTO, domain, and entity is non-trivial
- mapping repeats across multiple classes
- inline mapping is making services noisy

Good signals:
- controller, service, and repository all perform similar conversions
- mapping includes null, default, or format handling
- persistence objects differ from domain models

Avoid when:
- the mapping is a one-line transformation used once
- a dedicated mapper would be more verbose than the mapping itself
- conversion logic has no real complexity

Good fit:
- request to command DTO
- entity to domain model
- domain model to response DTO

## Builder

Use when:
- object construction has many optional values
- readability suffers from long parameter lists
- staged construction improves clarity

Good signals:
- constructor calls are hard to scan
- many nullable or optional fields exist
- test fixtures are hard to read

Avoid when:
- a data class copy or named arguments are already enough
- the builder adds ceremony without improving clarity
- the object is simple to construct

Good fit:
- complex search conditions
- report generation options
- recommendation filter options

## Domain Service

Use when:
- business logic belongs to the domain but does not fit naturally inside one entity or value object
- the logic coordinates multiple domain concepts
- the logic is domain-specific, not just orchestration

Good signals:
- the logic uses multiple domain models
- the behavior has real business meaning
- placing it in application service would make domain logic leak outward

Avoid when:
- the logic is application orchestration
- the logic is only calling repositories and external systems
- the logic belongs clearly inside one entity

Good fit:
- price calculation across multiple order rules
- recommendation ranking based on multiple domain factors

## Application Service

Use when:
- coordinating a use case
- orchestrating domain objects, repositories, and ports
- managing transaction boundaries or flow order

Good signals:
- one request triggers multiple domain and infrastructure interactions
- there is a clear use case boundary
- the logic is orchestration rather than core domain decision-making

Avoid when:
- the class becomes a dumping ground for unrelated use cases
- business rules that belong in domain are kept here
- one generic service keeps growing endlessly

Good fit:
- CreateOrderService
- RecommendTravelDestinationService
- ExchangeCurrencyService

## Decision shortcuts

Use Factory if:
- creation logic is complex and repeated

Use Strategy if:
- behavior varies by interchangeable rule set

Use Specification if:
- business predicates must be composed

Use Policy if:
- a named decision rule deserves isolation

Use Adapter if:
- an external system boundary exists

Use Facade if:
- callers should not manage subsystem complexity

Use Mapper if:
- translation noise is spreading

Use Builder if:
- object construction is hard to read with constructors alone

Use Domain Service if:
- domain logic spans multiple domain concepts

Use Application Service if:
- the task is use case orchestration

## Common anti-patterns

Do not:
- create interfaces just because “DDD should have interfaces”
- create one implementation per interface with no real reason
- put domain decisions into util classes
- use generic names like Manager, Helper, Processor, or Handler without clear responsibility
- replace simple code with theoretical architecture
- split classes just to mention a pattern
- treat every branching rule as Strategy
- treat every validation as Specification

## Review questions

Ask:
- Is the pattern solving a real problem or just adding abstraction?
- Does this pattern reduce coupling or only increase indirection?
- Would a simpler structure be easier to read and maintain?
- Is this responsibility better expressed as a use case, policy, mapper, or adapter?
- Is the pattern being introduced because complexity is real, or because it sounds architecturally nice?

## Default recommendation

Start simple.
Introduce patterns only after repeated complexity appears or a clear boundary needs protection.
Prefer practical structure over textbook pattern usage.