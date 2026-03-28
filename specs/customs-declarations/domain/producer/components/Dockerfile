# Customs Declarations — Java Components Docker Image
#
# Multi-stage build:
#   Stage 1: Maven build — compiles producer Java components into a JAR
#   Stage 2: Camel JBang runtime — runs YAML routes with the producer JAR on the classpath
#
# This demonstrates the HIP producer-authored Java component pattern:
# the platform builds a producer-supplied Maven project and includes the resulting JAR
# on the Camel classpath. Producers do not need to author a full Docker image or Helm chart.

# =============================================================================
# Stage 1: Build producer JAR
# =============================================================================
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# Copy POM first — allows Docker layer caching of dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn package -q -DskipTests

# =============================================================================
# Stage 2: Camel JBang runtime with producer JAR
# =============================================================================
FROM apache/camel-jbang:4.16.0

# Copy producer JAR into a well-known location on the image
COPY --from=build /app/target/customs-declarations-components-1.0.0.jar \
     /deps/customs-declarations-components.jar

# Copy YAML routes into the container
COPY routes/ /routes/

# Default entrypoint: demonstrates how the platform would launch the pipeline
# with the producer JAR on the classpath.
#
# --dep=file:///deps/... adds the producer JAR to the Camel JBang classpath.
# The YAML route references Java classes via #class: syntax — Camel resolves
# them from this classpath at startup.
#
# In production the platform injects the JAR path; producers do not write Dockerfiles.
ENTRYPOINT ["camel", "run"]
CMD ["/routes/post-declaration-java.yaml", \
     "--dep=camel:jackson", \
     "--dep=file:///deps/customs-declarations-components.jar"]
