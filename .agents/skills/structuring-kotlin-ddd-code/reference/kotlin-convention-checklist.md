# Kotlin Convention Checklist

Use this checklist when reviewing or rewriting Kotlin backend code.
Follow official Kotlin coding conventions by default.
Also prefer code that is easy to split, test, and navigate.

## 1. Naming

Check:
- package names are lowercase and concise
- class and object names are clear nouns
- function names clearly express action
- boolean names read naturally
- constants are clearly distinguishable
- DTO, request, response, mapper, and adapter names reflect their role

Prefer:
- `OrderService`
- `OrderQueryService`
- `CreateOrderCommand`
- `OrderController`
- `OrderEntityMapper`
- `ExchangeRateClientAdapter`

Avoid:
- vague names like `Manager`, `Helper`, `Util`, `Data`, `CommonService`
- names that hide responsibility

## 2. File responsibility

Check:
- one file has one main reason to change
- request/response DTOs are not bloating controllers
- mapper logic is not mixed into controller/service/repository unnecessarily
- validators and policies are separated when they become large

Prefer:
- one focused public type per file
- small support types only when tightly related

Avoid:
- many unrelated classes in one file
- giant files mixing controller, service, DTO, and entity

## 3. File size

Prefer:
- file length under 100 lines when reasonably possible
- short readable functions
- class size that can be understood quickly

If a file grows:
- split DTOs
- split mappers
- split validators
- split policies
- split services by responsibility
- split repository implementations

Do not:
- split mechanically if cohesion is still high

## 4. Class layout

Check:
- properties and constructor dependencies are easy to scan
- public API appears before private helpers when readable
- related methods are grouped together
- helper methods are kept near the logic they support

Prefer:
- consistent ordering
- one responsibility per class

Avoid:
- huge service classes with many unrelated methods
- utility dumping grounds

## 5. Function design

Check:
- the function does one clear thing
- branching is understandable
- parameter count is reasonable
- return type is explicit when needed
- side effects are obvious

Prefer:
- small functions with domain meaning
- extraction of repeated logic
- named arguments for readability

Avoid:
- long nested `let/run/apply/also` chains
- huge functions doing validation, mapping, persistence, and response formatting together

## 6. Null handling

Check:
- null is modeled intentionally
- nullable types are justified
- safe calls and Elvis operator are readable
- non-null assertions are avoided unless truly guaranteed

Prefer:
- explicit null handling
- domain rules that reduce accidental null spread

Avoid:
- `!!` without a strong reason
- hidden null assumptions

## 7. Mutability

Prefer:
- `val` by default
- immutable DTOs and domain values when possible

Use `var` only when:
- mutation is part of the model
- framework requirements make it necessary
- state transitions are explicit and controlled

Avoid:
- casual mutable state in services
- mutation across many helper methods

## 8. Data classes and models

Prefer:
- data classes for DTOs and value-like structures
- domain models that clearly express invariants

Check:
- data classes are not used blindly for every domain concept
- entity identity and lifecycle are considered

Avoid:
- anemic domain models when domain behavior exists
- stuffing all logic into services while entities stay empty

## 9. Expressions and readability

Prefer:
- expression bodies only when concise
- block bodies when logic needs room
- straightforward control flow

Avoid:
- clever one-liners that hide intent
- chaining many scope functions when local variables would be clearer

## 10. Imports and formatting

Check:
- imports are clean and not noisy
- spacing and indentation are consistent
- line breaks improve readability
- long parameter lists are formatted cleanly

Prefer:
- formatter-friendly code
- consistency over personal style quirks

## 11. Spring Boot specific structure checks

Check:
- controllers are thin
- services are responsibility-focused and stay cohesive
- repositories are abstractions where appropriate
- JPA entities are not leaking into API responses
- request/response DTOs are separated from persistence models

In this project specifically, also check:
- controller methods use action suffixes like `Add`, `Details`, `List`, `Modify`, `Remove`
- service methods use action prefixes like `add`, `find`, `modify`, `remove`
- application DTOs live in `application/dto`
- persistence entities may live in `entity`
- shared enums and similar cross-layer meaning types may live in `model`

Avoid:
- returning entities directly from controllers
- putting business rules in controller or repository implementation

## 12. Quick review questions

Ask:
- Does this file have one main responsibility?
- Is this class too large to understand quickly?
- Does this function mix multiple concerns?
- Is business logic sitting in the wrong layer?
- Would a mapper, policy, or adapter make this clearer?
- Would introducing a pattern make this simpler, or just more abstract?
