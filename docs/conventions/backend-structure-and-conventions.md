# Backend Structure and Conventions

이 문서는 현재 프로젝트의 Kotlin Spring Boot 백엔드 구조와 코드 컨벤션을 **설명하기 위한 문서**다.

목표는 두 가지다.

1. 새로 들어온 사람이 현재 구조를 빠르게 이해할 수 있게 한다.
2. 앞으로 기능을 추가하거나 리팩터링할 때, 왜 이런 구조를 선택했는지 같은 이유까지 함께 공유한다.

이 문서는 현재 실제 코드 기준으로 작성되었다. 문서와 코드가 어긋나기 시작하면 문서보다 코드를 먼저 믿고, 문서를 바로 갱신하는 것을 원칙으로 한다.

---

## 1. 현재 백엔드 구조 개요

현재 백엔드는 feature-first 구조를 기본으로 한다. 즉, 공통 기술 패키지를 먼저 나누는 대신, `jobs` 같은 기능 단위 아래에 필요한 계층을 모은다.

예시 `jobs` 기능의 기준 구조는 아래와 같다.

```text
backend/src/main/kotlin/com/iportfolio/backend/domain/jobs
  application
    JobService.kt
    JobResultMapper.kt
    dto/
      CreateJobCommand.kt
      JobResult.kt
      JobStreamMessage.kt
  entity
    Job.kt
  model
    JobType.kt
    JobStatus.kt
  infrastructure
    messaging/
      JobStreamPublisher.kt
      RedisJobStreamPublisher.kt
    repository/
      JobRepository.kt
  presentation
    JobController.kt
    JobPresentationMapper.kt
    JobRequests.kt
    JobResponse.kt
```

이 구조를 택한 이유는, 기능 하나를 읽을 때 필요한 코드가 같은 영역 안에 모여 있어 탐색이 쉽기 때문이다. 반대로 `controller`, `service`, `repository` 같은 기술별 전역 패키지 구조는 프로젝트가 커질수록 한 기능의 흐름을 따라가기가 어려워진다.

---

## 2. 패키지별 책임

### 2.1 `presentation`

`presentation`은 HTTP 진입점이다.

여기에는 다음만 둔다.

- controller
- request/response DTO
- HTTP 입출력 매핑
- HTTP status, validation, 예외 변환

여기서 중요한 원칙은 **컨트롤러는 얇아야 한다**는 점이다. 컨트롤러는 요청을 받고, 서비스 호출하고, 응답을 반환하는 역할만 해야 한다. 비즈니스 로직, persistence 호출 조합, 외부 시스템 호출 조합이 컨트롤러 안으로 들어오면 금방 읽기 어려워진다.

예를 들어 현재 `JobController`는 다음 흐름만 가진다.

- 요청 받기
- request를 command로 바꾸기
- `jobService.addJob(...)` 또는 `jobService.findJob(...)` 호출
- 결과를 response로 바꾸기

이 정도면 컨트롤러 역할에 충실한 구조다.

---

### 2.2 `application`

`application`은 유스케이스를 실제로 조합하는 계층이다.

현재 프로젝트에서는 `UseCase`라는 이름보다 `Service`를 선호하므로, application의 핵심 진입 클래스는 `JobService` 같은 이름을 사용한다.

여기에는 다음을 둔다.

- 기능 실행 흐름을 조합하는 서비스
- 트랜잭션 경계
- persistence 저장 호출
- 메시징 발행 호출
- entity → application result 변환

여기서 중요한 점은, **application은 HTTP나 Redis 세부 포맷에 끌려가지 않되, 실제 작업 흐름을 책임진다**는 것이다.

예를 들어 `JobService.addJob(...)`는 다음 순서로 동작한다.

1. command를 받는다.
2. `Job` entity를 만든다.
3. `JobRepository`로 저장한다.
4. `JobStreamPublisher`로 메시지를 발행한다.
5. 저장된 entity를 `JobResult`로 바꿔 반환한다.

즉, “job 생성”이라는 하나의 유스케이스를 실제로 수행하는 계층이다.

---

### 2.3 `application/dto`

`application/dto`는 application 계층이 사용하는 입력/출력 모델을 둔다.

현재는 아래 타입들이 여기에 있다.

- `CreateJobCommand`
- `JobResult`
- `JobStreamMessage`

이 패키지를 따로 둔 이유는, 서비스 클래스와 데이터 운반 객체를 같은 디렉터리에 섞어두면 탐색성이 떨어지기 때문이다. 또한 presentation request/response DTO와 application DTO는 성격이 다르다.

- `presentation` DTO는 HTTP 계약을 표현한다.
- `application/dto`는 유스케이스 입출력을 표현한다.

둘을 분리하면 컨트롤러 변경과 서비스 변경의 경계가 더 명확해진다.

---

### 2.4 `entity`

`entity`는 persistence entity를 둔다.

현재 `Job`은 JPA annotation을 포함하고 있기 때문에, 순수 비즈니스 개념이라기보다 **저장 모델에 가까운 객체**다. 그래서 이 프로젝트에서는 `domain`이 아니라 `entity` 패키지로 분리했다.

이 선택의 장점은 다음과 같다.

- JPA annotation이 붙은 타입이 무엇인지 바로 보인다.
- “순수 도메인 규칙 객체”와 “DB에 저장되는 객체”를 구분하기 쉽다.
- 팀원이 코드를 읽을 때 이 타입이 persistence concern을 가진다는 사실을 빠르게 이해할 수 있다.

반대로 단점도 있다.

- DDD를 엄격하게 적용하는 관점에서는 entity도 domain 일부로 볼 수 있다.

하지만 이 프로젝트는 이론적 순도보다 **탐색성과 실무 가독성**을 우선하기 때문에 `entity` 패키지를 선택했다.

---

### 2.5 `model`

`model`은 shared meaning type을 둔다.

현재는 아래 enum이 여기에 있다.

- `JobType`
- `JobStatus`

이 타입들을 `entity`에 넣지 않은 이유는, 이 값들이 entity 전용이 아니기 때문이다. 실제로 이 값들은 다음 여러 계층에서 함께 사용된다.

- request/response DTO
- application DTO
- service
- entity
- messaging
- test

즉 이 값들은 특정 저장 객체의 내부 detail이 아니라, 시스템 전체에서 공유되는 의미값이다. 그래서 `entity`보다 더 중립적인 `model`에 두는 것이 맞다.

---

### 2.6 `infrastructure/repository`

여기는 저장 기술과 직접 연결되는 repository를 둔다.

현재는 `JobRepository`가 있다.

```kotlin
interface JobRepository : JpaRepository<Job, Long>
```

이름을 `SpringDataJobJpaRepository`처럼 길게 두지 않은 이유는, 현재 구조가 별도 domain repository port 없이 **직접 Spring Data JPA repository를 사용하는 구조**이기 때문이다. 이 경우 메인 repository 이름은 기술을 덜 드러내는 편이 더 읽기 좋다.

즉 현재 규칙은 다음과 같다.

- 기본 저장소: `JobRepository`
- Querydsl 복잡 조회 저장소가 생기면: `JobQueryRepository`
- MyBatis면: `JobMapper`
- JdbcTemplate면: `JobJdbcDao`

핵심은 “기본 repository는 역할명”, “기술 관례가 강한 경우에만 기술명을 드러낸다”이다.

---

### 2.7 `infrastructure/messaging`

메시징 관련 타입은 `infrastructure/messaging`에 둔다.

현재는 아래 구성이 있다.

- `JobStreamPublisher`
- `RedisJobStreamPublisher`

이렇게 둔 이유는 이 프로젝트가 repository abstraction도 최소화하고 있고, 메시징도 현재 Redis Streams 기반 concrete 구조를 택하고 있기 때문이다. 따라서 메시징 관련 인터페이스와 구현체를 한 군데 모아 두는 편이 더 자연스럽다.

---

## 3. 클래스 및 메서드 네이밍 규칙

### 3.1 Controller 메서드 이름

컨트롤러 메서드는 **도메인명 + 액션 suffix** 규칙을 따른다.

예시:

- `orderList()`
- `orderDetails()`
- `orderAdd()`
- `orderModify()`
- `orderRemove()`

현재 jobs 예시:

- `jobAdd()`
- `jobDetails()`

이 규칙을 쓰는 이유는, HTTP endpoint 메서드를 읽을 때 “이 메서드가 조회인지 생성인지”가 이름에서 바로 보이기 때문이다.

---

### 3.2 Service 메서드 이름

서비스 메서드는 **액션 prefix + 도메인명** 규칙을 따른다.

예시:

- `findOrder()`
- `addOrder()`
- `modifyOrder()`
- `removeOrder()`

현재 jobs 예시:

- `addJob()`
- `findJob()`

이 규칙은 service가 실제로 수행하는 유스케이스를 이름에서 드러내기 위해 사용한다.

---

### 3.3 Service 클래스 이름

현재 프로젝트에서는 `JobService` 같은 단일 서비스명을 **무조건 금지하지 않는다.**

중요한 기준은 이름이 아니라 **응집도**다.

좋은 경우:

- `JobService` 안에 `addJob`, `findJob`, `listJobs`, `cancelJob`, `retryJob` 정도가 있고
- 모두 job lifecycle 관리라는 같은 책임 아래 묶여 있을 때

나빠지기 시작하는 경우:

- 여기에 `generateStoryboard`, `cloneVoice`, `synthesizeAudio`, `syncStatusFromAiService` 같이
- AI orchestration과 외부 시스템 동기화까지 한곳에 몰릴 때

즉 단일 서비스는 허용되지만, **dumping ground가 되면 분리**하는 것이 원칙이다.

---

## 4. 왜 `entity`, `model`, `application/dto`로 나누는가

이 구분은 단순히 폴더를 예쁘게 만들기 위한 것이 아니다. 변경 이유가 서로 다른 코드들을 분리하기 위한 것이다.

### `entity`
- DB 저장 구조가 바뀔 때 같이 바뀐다.

### `model`
- 시스템 전체에서 공유되는 의미값이 바뀔 때 같이 바뀐다.

### `application/dto`
- 유스케이스 입출력이나 orchestration 흐름이 바뀔 때 같이 바뀐다.

### `presentation`
- HTTP 계약이나 validation 방식이 바뀔 때 같이 바뀐다.

이렇게 나누면, 어떤 변경이 어느 레이어를 건드려야 하는지 더 빨리 판단할 수 있다.

---

## 5. 좋은 예와 피해야 할 예

### 좋은 예

- 컨트롤러는 얇고, 서비스 호출과 예외 변환만 한다.
- request/response DTO는 `presentation`에 둔다.
- command/result/message 같은 유스케이스 DTO는 `application/dto`에 둔다.
- persistence entity는 `entity`에 둔다.
- shared enum은 `model`에 둔다.
- 기본 repository는 `JobRepository`처럼 역할 중심으로 이름 짓는다.

### 피해야 할 예

- controller에서 repository를 직접 호출하는 것
- request DTO를 service에 그대로 넘기는 것
- JPA entity를 API response로 직접 반환하는 것
- shared enum을 `entity`에 넣어서 non-persistence 코드까지 `entity` 패키지에 의존하게 만드는 것
- 서비스 하나에 unrelated AI workflow까지 몰아넣는 것

---

## 6. 새 기능 추가 체크리스트

새 기능을 추가할 때는 아래를 먼저 확인한다.

1. 기능 패키지가 feature-first로 묶였는가?
2. controller가 얇은가?
3. HTTP DTO가 `presentation`에 있는가?
4. application DTO가 `application/dto`에 있는가?
5. persistence entity는 `entity`에 두는 게 맞는가?
6. shared enum이나 공통 의미값은 `model`이 맞는가?
7. repository 이름이 역할 중심인가?
8. 메서드명이 controller/service 규칙을 따르는가?
9. 지금 구조가 응집된 단일 서비스로 유지 가능한가, 아니면 이미 분리 시점인가?

---

## 7. 현재 jobs 흐름 예시

현재 `jobs` 기능의 생성 흐름은 아래처럼 읽으면 된다.

1. `JobController.jobAdd()`가 요청을 받는다.
2. `CreateJobRequest`를 `CreateJobCommand`로 바꾼다.
3. `JobService.addJob()`가 `Job` entity를 생성한다.
4. `JobRepository.save(...)`로 저장한다.
5. `JobStreamPublisher.publish(...)`로 Redis Streams에 이벤트를 발행한다.
6. 저장된 결과를 `JobResult`로 바꾼다.
7. 최종적으로 `JobResponse`로 반환한다.

이 흐름이 현재 프로젝트가 의도하는 “얇은 controller + 응집된 service + 명확한 DTO 경계”의 대표 예시다.

---

## 8. 마지막 원칙

이 문서의 핵심은 “정답인 아키텍처”를 고정하는 것이 아니라, **현재 프로젝트가 읽기 쉽고 유지보수하기 쉬운 구조를 유지하는 것**이다.

즉 앞으로도 기준은 같다.

- 더 단순한 구조가 맞으면 단순하게 간다.
- 더 많은 책임이 섞이기 시작하면 분리한다.
- 문서보다 코드를 우선하되, 코드가 바뀌면 문서도 같이 업데이트한다.

이 문서는 그 판단 기준을 팀이 공유하기 위한 문서다.
