# Продакшн-деплой

Фронтенд (React/Vite, статика) идёт на **Vercel**. Бэкенд (Spring Boot, обычный процесс с
сессиями) идёт на **Render** как Docker-сервис — Vercel/Netlify/GitHub Pages для него не
подходят (нет постоянного серверного рантайма и Java-поддержки). См. также
[backend/README.md](../backend/README.md) и [frontend/README.md](../frontend/README.md) для
локальной разработки.

## 1. Backend → Render

1. Зайдите на [render.com](https://render.com) и залогиньтесь через GitHub.
2. **New > Blueprint**, выберите репозиторий `TheDarkSolo/youTubeMusic` — Render подхватит
   [`render.yaml`](../render.yaml) из корня и создаст Docker-сервис из `backend/Dockerfile`
   на бесплатном плане.
   - Если предпочитаете ручную настройку вместо Blueprint: **New > Web Service**, Runtime =
     Docker, Root Directory = `backend`, Dockerfile Path = `Dockerfile`.
3. В настройках сервиса (**Environment**) задайте переменные:

   | Переменная | Значение |
   |---|---|
   | `GOOGLE_CLIENT_ID` | из Google Cloud Console (шаг 3 ниже) |
   | `GOOGLE_CLIENT_SECRET` | из Google Cloud Console |
   | `GOOGLE_REDIRECT_URI` | `https://<ваш-backend>.onrender.com/api/auth/callback` |
   | `FRONTEND_BASE_URL` | `https://<ваш-frontend>.vercel.app` (заполните после шага 2) |

   `COOKIE_SAME_SITE=none` и `COOKIE_SECURE=true` уже заданы в `render.yaml` — они обязательны,
   поскольку фронтенд и бэкенд будут на разных доменах.
4. Задеплойте. Запомните публичный URL бэкенда (`https://ytmusic-backend.onrender.com` и т.п.).

   Free-план Render засыпает после ~15 минут простоя — первый запрос после сна будет
   отвечать медленно (десятки секунд), это ожидаемо для бесплатного тарифа.

## 2. Frontend → Vercel

1. [vercel.com](https://vercel.com) → залогиньтесь через GitHub → **Add New > Project** →
   выберите тот же репозиторий.
2. **Root Directory**: `frontend`. Vercel сам определит Vite-пресет (`npm run build`, output
   `dist`) — менять ничего не нужно.
3. **Environment Variables**: добавьте `VITE_API_BASE_URL` = URL бэкенда из шага 1
   (`https://ytmusic-backend.onrender.com`).
4. Deploy. Запомните финальный URL (`https://<project>.vercel.app`).
5. Вернитесь в Render и обновите `FRONTEND_BASE_URL` на этот URL, передеплойте бэкенд (CORS
   настроен на один явный origin — см. [CorsConfig.java](../backend/src/main/java/com/ytmusicmerger/backend/config/CorsConfig.java)).

## 3. Google Cloud Console — продовые настройки OAuth

В том же проекте, что использовался для локальной разработки (см.
[backend/README.md](../backend/README.md#1-get-google-oauth-credentials)):

1. **APIs & Services > Credentials** → откройте ваш OAuth Client ID → добавьте в
   **Authorized redirect URIs** продовый `GOOGLE_REDIRECT_URI` из шага 1 (локальный URI можно
   оставить рядом, для разработки).
2. **APIs & Services > OAuth consent screen**:
   - **App homepage**: URL фронтенда с Vercel.
   - **Privacy policy**: `https://<ваш-frontend>.vercel.app/privacy.html` (шаблон уже в
     [frontend/public/privacy.html](../frontend/public/privacy.html) — прочитайте и
     отредактируйте текст под себя перед публикацией, это не юридическая консультация).

## 4. Публичный доступ vs. verification

Приложение запрашивает scope `.../auth/youtube` — Google относит его к **restricted**. Пока
consent screen в статусе **Testing**, войти могут только вручную добавленные test-пользователи
(**OAuth consent screen > Test users**, до 100 email) — это работает сразу, без ожидания.

Чтобы пускать вообще любого пользователя, нужно нажать **Publish app** и пройти верификацию
Google для restricted-scope — это отдельный процесс на стороне Google (проверка privacy policy,
возможен CASA security assessment), может занять недели. Отправить заявку можно на той же
странице **OAuth consent screen** после заполнения homepage/privacy policy из шага 3.
