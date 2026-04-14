# Spring Boot DDD Examples

Use these examples as practical reference points for **this project's current Kotlin + Spring Boot conventions**, not as generic textbook DDD.

This reference is intentionally biased toward the current project direction:

- feature-first packaging
- thin controllers
- `application/dto` for application input/output models
- `entity` for persistence entities when separated from pure domain types
- `model` for shared enums and cross-layer meaning types
- neutral repository names such as `JobRepository`
- action-oriented controller and service method names

If a future change intentionally adopts a different pattern, update this file together with `SKILL.md`.

---

## Example 1: Current Preferred Jobs Slice

Use this shape when:

- one feature already has a clear API entry point
- persistence entity and shared enums are intentionally separated
- the team wants human-readable package boundaries over strict textbook layering

```text
domain/jobs
  application
    JobService.kt
    JobResultMapper.kt
    dto
      CreateJobCommand.kt
      JobResult.kt
      JobStreamMessage.kt
  entity
    Job.kt
  model
    JobType.kt
    JobStatus.kt
  infrastructure
    repository
      JobRepository.kt
    messaging
      JobStreamPublisher.kt
      RedisJobStreamPublisher.kt
  presentation
    JobController.kt
    JobPresentationMapper.kt
    JobRequests.kt
    JobResponse.kt
```

Why this shape works here:

- `presentation` stays focused on HTTP
- `application` owns orchestration and use-case DTOs
- `entity` makes it explicit that `Job` is persistence-shaped
- `model` keeps `JobType` and `JobStatus` out of `entity` because they are reused by API, application, messaging, and entity together
- `infrastructure` keeps repository and Redis messaging details together

---

## Example 2: Thin Controller with Project Naming

Use this shape when:

- the controller should only translate HTTP to application calls
- request and response mapping should stay outside the service
- the project naming rule wants action suffixes such as `Add`, `Details`, `List`, `Modify`, `Remove`

```kotlin
@RestController
@RequestMapping("/api/jobs")
class JobController(
    private val jobService: JobService,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun jobAdd(@Valid @RequestBody request: CreateJobRequest): JobResponse {
        val result = jobService.addJob(request.toCommand())
        return result.toResponse()
    }

    @GetMapping("/{id}")
    fun jobDetails(@PathVariable id: Long): JobResponse = jobService.findJob(id)
        ?.toResponse()
        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found")
}
```

Keep out of controllers:

- repository calls
- entity construction
- business status decisions
- Redis publishing logic
- cross-layer mapping noise that belongs in a mapper file

---

## Example 3: Single Cohesive Service

Use this shape when:

- one service can stay small and cohesive
- create and read behavior still belong to the same feature-level service
- splitting would make navigation worse than it helps

```kotlin
@Service
class JobService(
    private val jobRepository: JobRepository,
    private val jobStreamPublisher: JobStreamPublisher,
) {
    @Transactional
    fun addJob(command: CreateJobCommand): JobResult {
        val now = Instant.now()
        val savedJob = jobRepository.save(
            Job(
                jobType = command.jobType,
                status = JobStatus.PENDING,
                storyId = command.storyId,
                payload = command.payload,
                createdAt = now,
                updatedAt = now,
            ),
        )

        jobStreamPublisher.publish(
            JobStreamMessage(
                jobId = savedJob.id,
                jobType = savedJob.jobType,
                status = savedJob.status,
                storyId = savedJob.storyId,
                payload = savedJob.payload,
            ),
        )

        return savedJob.toJobResult()
    }

    fun findJob(id: Long): JobResult? = jobRepository.findById(id)
        .orElse(null)
        ?.toJobResult()
}
```

Why this is acceptable in this project:

- `JobService` is not a dumping ground yet
- method names still follow the project rule: `add...`, `find...`
- create/read logic is short and easy to scan

Split this later only when responsibilities truly diverge.

---

## Example 4: Application DTO Placement

Use this shape when:

- the service should not depend on presentation request/response DTOs
- the application layer needs stable input/output models
- messaging payloads are part of use-case orchestration rather than HTTP transport

Recommended files:

```text
application/dto/CreateJobCommand.kt
application/dto/JobResult.kt
application/dto/JobStreamMessage.kt
presentation/JobRequests.kt
presentation/JobResponse.kt
```

Recommended rule:

- HTTP request/response models stay in `presentation`
- service input/output models stay in `application/dto`
- avoid importing presentation DTOs into services

Bad fit:

- controller request objects passed directly into services
- response objects reused as repository or messaging payloads

---

## Example 5: Entity vs Model Separation

Use this shape when:

- one persistence object is clearly JPA-shaped
- enums or shared types are reused across multiple layers
- the team wants package names to reveal intent quickly

```text
entity/Job.kt
model/JobType.kt
model/JobStatus.kt
```

Interpretation:

- `entity/Job.kt` = persistence entity, includes JPA annotations
- `model/JobType.kt` and `model/JobStatus.kt` = shared meaning types reused by API, service, messaging, tests, and entity

Do **not** push shared enums into `entity` if they are used by:

- request DTOs
- response DTOs
- application DTOs
- event or stream message types

That would make non-persistence code depend on an `entity` package for no good reason.

---

## Example 6: Repository Naming in This Project

Use this naming when:

- Spring Data JPA is being used directly
- there is no separate domain repository port
- the team prefers technology-neutral names for primary repositories

Recommended shape:

```text
infrastructure/repository/JobRepository.kt
```

```kotlin
interface JobRepository : JpaRepository<Job, Long>
```

If Querydsl later becomes necessary for heavier reads, prefer:

```text
infrastructure/repository/JobQueryRepository.kt
```

Why this naming works:

- `JobRepository` reads as the main repository for the feature
- `JobQueryRepository` reads as the complex-query companion
- names stay stable even if the implementation details evolve

Technology-specific alternatives like `JobMapper` or `JobJdbcDao` are still appropriate when the actual technology has a strong naming convention.

---

## Example 7: Messaging Boundary in Infrastructure

Use this shape when:

- the application service publishes work to Redis or another queue
- the project is not maintaining a full output-port abstraction everywhere
- the messaging implementation is concrete and infrastructure-owned

```text
infrastructure/messaging/JobStreamPublisher.kt
infrastructure/messaging/RedisJobStreamPublisher.kt
```

```kotlin
interface JobStreamPublisher {
    fun publish(message: JobStreamMessage)
}

@Component
class RedisJobStreamPublisher(
    private val redisTemplate: StringRedisTemplate,
) : JobStreamPublisher {
    override fun publish(message: JobStreamMessage) {
        // Redis stream write
    }
}
```

Why this shape works here:

- the interface and implementation both belong to the messaging concern
- the application service depends on a feature-local infrastructure contract
- the code stays practical without pretending the whole architecture is technology-neutral

---

## Example 8: When to Split a Service Again

Current project rule:

- one cohesive service is acceptable
- broad services are bad only when they become dumping grounds

Still acceptable while responsibilities stay cohesive:

```text
JobService.kt
  - addJob
  - findJob
  - listJobs
  - cancelJob
  - retryJob
```

Starts to become a bad shape when unrelated AI-specific workflows are added into the same service:

```text
JobService.kt
  - addJob
  - findJob
  - listJobs
  - cancelJob
  - retryJob
  - generateStoryboard
  - cloneVoice
  - synthesizeAudio
  - syncStatusFromAiService
```

Better shape after growth:

```text
application/JobCommandService.kt
application/JobQueryService.kt
application/StoryboardJobService.kt
application/TtsJobService.kt
```

Split when:

- methods belong to different workflows
- AI orchestration starts mixing with generic CRUD
- read and write concerns become noisy
- the service stops being easy to scan in one pass

Do not split purely out of habit.

---

## Example 9: Human Review Checklist for New Features

When adding a new backend feature in this project, check these first:

1. Is the package feature-first?
2. Are HTTP DTOs in `presentation`?
3. Are application DTOs in `application/dto`?
4. Is the persistence entity in `entity` if the team wants it separated?
5. Are shared enums or meaning types in `model` if multiple layers use them?
6. Is the main repository named `XRepository`?
7. If complex reads exist, is there an `XQueryRepository` rather than query logic leaking into controllers?
8. Are controller methods using action suffixes like `Add`, `Details`, `List`, `Modify`, `Remove`?
9. Are service methods using action prefixes like `add`, `find`, `modify`, `remove`?
10. Is the controller still thin?

---

## Practical Defaults

Prefer these defaults unless complexity proves otherwise:

- one cohesive service is better than a premature service split
- one thin controller is better than controller-side orchestration
- one neutral repository name is better than unnecessary technology leakage
- one explicit `entity` package is better than pretending a JPA entity is pure domain
- one explicit `model` package is better than forcing shared enums into `entity`
- one focused mapper file is better than repeating conversion code in controllers and services
