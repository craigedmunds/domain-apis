# VPD Domain API - Camel Java DSL (Quarkus)
#
# Multi-stage build:
#   Stage 1 (build): Maven + JDK 21 — compiles and packages the Quarkus app
#   Stage 2 (run):   JRE 21 slim — runs the fast-jar
#
# The resulting image is ~200MB vs ~300MB for the JBang YAML DSL image,
# and starts in ~2-3s vs 5-15s for JBang.

# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# Cache dependencies layer: copy pom.xml first, then resolve deps
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn package -q

# ---------------------------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Copy the Quarkus fast-jar
COPY --from=build /app/target/quarkus-app/lib/ ./lib/
COPY --from=build /app/target/quarkus-app/*.jar ./
COPY --from=build /app/target/quarkus-app/app/ ./app/
COPY --from=build /app/target/quarkus-app/quarkus/ ./quarkus/

# Expose port 8082 (YAML DSL uses 8080, Java uses 8082)
EXPOSE 8082

# Run as non-root user (security best practice)
RUN useradd -r -u 1000 camel
USER camel

ENTRYPOINT ["java", \
    "-jar", \
    "quarkus-run.jar"]
