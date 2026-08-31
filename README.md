# YT Music Manager

Web app to manage YouTube Music: join duplicate playlists and delete duplicate songs. Inspired by personal needs — TuneMyMusic imports from Spotify create duplicate playlists in YouTube Music.

Веб-приложение для объединения дублирующихся плейлистов YouTube Music (например, после импорта из Spotify через TuneMyMusic) и удаления повторяющихся треков.

## Стек

- **Backend**: Java 17, Spring Boot, Maven — интеграция с YouTube Data API v3 (OAuth 2.0)
- **Frontend**: React (Vite)
- **API**: официальный YouTube Data API v3 (плейлисты YouTube Music — это обычные YouTube-плейлисты)

## Статус

Проект в разработке. См. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) для архитектуры и API-контракта.

## Запуск

См. инструкции в [backend/README.md](backend/README.md) и [frontend/README.md](frontend/README.md) (появятся по мере готовности).
