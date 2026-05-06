# syntax=docker/dockerfile:1.7
FROM gradle:8.14.3-jdk17 AS builder

WORKDIR /app

COPY gradlew gradlew.bat build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle

RUN chmod +x gradlew

COPY src ./src

# application-example.yml을 유일한 tracked source of truth로 강제.
# build 시점에 항상 덮어쓰기 → application.yml은 빌드 결과물(derived).
# 로컬 dev도 application.yml에 커스텀을 두지 말고 반드시 example을 편집할 것.
# (그래야 CI가 clean-clone 해도 동일한 결과. 드리프트 불가능.)
RUN cp -f src/main/resources/application-example.yml src/main/resources/application.yml

# BuildKit cache mount 으로 Gradle 의존성 / wrapper / project 빌드 캐시를 호스트에 영구 보존.
#
# 효과:
#  - layer 가 무효화돼도 (예: src 변경, build.gradle.kts 변경) cache mount 안의 jar 는 재사용 →
#    Spring Boot/Kotlin/AWS SDK 등 ~300MB 의존성 재다운로드 회피 (보통 60~70초 절약).
#  - 의존성 추가 시엔 새 jar 1개만 다운로드, 기존은 즉시 재사용.
#  - kotlin daemon / build-cache index 도 보존 → incremental compile 도 cross-build 로 동작.
#
# 전제: 호스트 docker daemon 에서 BuildKit 활성 (Docker 23+ default, GitLab runner 의 docker engine 확인).
# 필요 시: 호스트 환경변수 DOCKER_BUILDKIT=1 또는 `docker buildx build`.
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    --mount=type=cache,target=/app/.gradle \
    ./gradlew bootJar --no-daemon -x test --build-cache

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
