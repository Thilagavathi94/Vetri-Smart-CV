FROM maven:3.9.8-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
RUN mvn -DskipTests dependency:go-offline

COPY src ./src

# Force Spring Boot to build a fully repackaged executable jar with runtime dependencies.
RUN mvn -DskipTests clean package spring-boot:repackage

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/vetrismartcv-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 10000

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-10000} -jar /app/app.jar"]
