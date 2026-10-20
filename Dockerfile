FROM gradle:8.11-jdk21 AS build
WORKDIR /app

COPY settings.gradle.kts build.gradle.kts ./
RUN gradle dependencies --no-daemon > /dev/null

COPY src ./src
RUN gradle installDist --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/build/install/ ./
EXPOSE 8000

CMD ["servare-api/bin/servare-api"]
