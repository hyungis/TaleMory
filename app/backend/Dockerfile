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

RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
