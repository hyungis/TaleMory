# Package Templates

Use these templates as starting points for Kotlin backend package design.

Default to the smallest structure that:
- keeps business logic out of controllers
- keeps persistence and framework details out of domain
- keeps responsibilities obvious
- keeps files easy to navigate

Prefer package organization by domain or feature first.

## Template Selection

Choose `small-project` when:
- there are 1 to 3 main domains
- business rules are still simple
- external integrations are limited
- one team owns most of the code

Choose `medium-project` when:
- each domain has multiple use cases
- mapping or validation logic is growing
- external integrations are increasing
- read and write orchestration is becoming more explicit

Choose `multi-domain` when:
- bounded contexts are clearly separate
- multiple teams or ownership boundaries exist
- domains evolve independently
- cross-domain coordination should stay explicit

Choose `read-write-split` when:
- query and command flows differ significantly
- read models and write models want different shapes
- performance or maintenance needs justify the split

Choose `integration-heavy` when:
- many external services exist
- adapter boundaries matter
- provider-specific details must stay isolated

## Small Project

Use this for small Spring Boot or Kotlin server projects.

```text
com.example.project
  common
    config
    exception
    response
    util
  domain
    user
      application
        dto
        UserService.kt
      domain
        UserPolicy.kt
      entity
        User.kt
      model
        UserType.kt
      infrastructure
        repository
        messaging
      presentation
        UserController.kt
        UserRequests.kt
        UserResponse.kt
```

Guidelines:
- keep application thin and service-oriented
- keep domain focused on business rules
- keep controllers very small
- keep repository names neutral when using direct Spring Data JPA, such as `UserRepository`
- keep persistence entities in `entity` when the team wants them separated from pure domain types
- keep shared enums or cross-layer meaning types in `model` when reused across layers

## Medium Project

Use this when domains are growing and boundaries need more explicit ports and responsibilities.

```text
com.example.project
  common
    config
    exception
    logging
    response
    util
  domain
    user
      application
        dto
        UserCommandService.kt
        UserQueryService.kt
      domain
        policy
      entity
        User.kt
      model
        UserStatus.kt
      infrastructure
        external
        mapper
        repository
        messaging
      presentation
        UserController.kt
        UserRequests.kt
        UserResponse.kt
    order
      application
      entity
      model
      infrastructure
      presentation
```

Guidelines:
- introduce input and output ports only when boundaries are meaningful, not as a default
- separate orchestration from domain decision logic
- split request and response DTOs away from controllers
- split mapper and validator logic into dedicated files when noise grows
- do not assume `usecase` packages are mandatory if cohesive service classes are enough

## Multi-Domain

Use this when bounded contexts should remain strongly separated.

```text
com.example.project
  common
    config
    exception
    security
    util
  domain
    member
      application
      domain
      infrastructure
      presentation
    travel
      application
      domain
      infrastructure
      presentation
    payment
      application
      domain
      infrastructure
      presentation
  support
    batch
    events
    messaging
```

Guidelines:
- do not collapse business logic into `common`
- keep cross-domain coordination in application services or explicit integration points
- avoid direct infrastructure coupling between domains
- keep shared support code separate from domain logic

## Read/Write Split

Use this only when the difference between command and query code is meaningful.

```text
com.example.project
  domain
    order
      application
        command
          dto
          OrderCommandService.kt
        query
          dto
          OrderQueryService.kt
      entity
        Order.kt
      model
        OrderStatus.kt
        policy
      infrastructure
        repository
        query
      presentation
```

Guidelines:
- do not introduce this split for trivial CRUD
- keep domain concepts shared unless the model truly diverges
- use it when query optimization and write-side rules pull in different directions

## Integration-Heavy

Use this when external systems are a major part of the feature.

```text
com.example.project
  domain
    exchange
      application
        dto
        ExchangeService.kt
        port
          output
      domain
        policy
      entity
      model
      infrastructure
        external
          adapter
          client
          dto
        mapper
        repository
      presentation
```

Guidelines:
- hide external API details behind output ports and adapters
- do not expose external DTOs to domain or presentation
- keep provider-specific mapping and retry logic inside infrastructure

## Selection Rules

Choose the simplest template that still protects the important boundaries.

Do:
- start simple and split later
- add packages because responsibilities differ, not because the pattern looks cleaner
- keep package depth proportional to real complexity

Do not:
- create deep package trees for tiny projects
- add `port`, `usecase`, or `policy` packages when the domain is still trivial
- split packages mechanically without a responsibility reason

Project-specific note:
- In this project, `entity` and `model` are both valid top-level feature subpackages.
- `application/dto` is preferred for service input/output models.
- `usecase` is optional, not the default naming convention.
