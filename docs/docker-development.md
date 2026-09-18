# Docker development

See [backend development](backend-development.md#local-infrastructure) for the implemented Compose environment, health checks and smoke-test command.

The API, pinned LiveKit and Mailpit services are defined in `docker-compose.yml`. SQLite uses a named volume. Secrets come from `.env`; Gmail is optional and requires all five configuration fields. Docker smoke tests create temporary credentials and an isolated project and tear down only their own volumes.
