# Render Deployment Notes

## Service Root

Use this app folder as the service root:

`vetrismartcv-updated/vetrismartcv-AI_Resume_updated/vetrismartcv-AI Resume/output`

If you use Render Blueprint, the included `render.yaml` already points there.

## Required Environment Variables

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `OAUTH_GOOGLE_CLIENT_ID`
- `OAUTH_LINKEDIN_CLIENT_ID`
- `OAUTH_LINKEDIN_CLIENT_SECRET`
- `OAUTH_LINKEDIN_REDIRECT_URI`

## Recommended Values

- `SPRING_JPA_HIBERNATE_DDL_AUTO=update`
- `SPRING_THYMELEAF_CACHE=true`
- `SERVER_SERVLET_SESSION_COOKIE_SECURE=true`

## Build / Start

- Build: `mvn clean package -DskipTests`
- Start: `java -Dserver.port=$PORT -jar target/vetrismartcv-0.0.1-SNAPSHOT.jar`

## LinkedIn OAuth

Set your LinkedIn app callback URL to:

`https://<your-render-domain>/oauth/linkedin/callback`

and use the same value for `OAUTH_LINKEDIN_REDIRECT_URI`.

## Google OAuth

Add your Render domain to allowed origins in Google Cloud Console and set:

`OAUTH_GOOGLE_CLIENT_ID`

## Important

This app currently assumes a real MySQL database. Do not deploy with the local XAMPP database settings.
