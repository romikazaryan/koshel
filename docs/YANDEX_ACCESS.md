## YandexGPT / Vision (OCR) доступ для Edge Functions

Цель: вызывать YandexGPT (Foundation Models) и Yandex Vision (OCR) **не из мобильного приложения**, а из **Supabase Edge Functions**, чтобы ключи и service-account приватные данные не попадали в APK/IPA.

### 0) Что вам понадобится
- `FOLDER_ID` (каталог в Yandex Cloud).
- Service account в Yandex Cloud + его приватный ключ (или готовый IAM token, но токен всё равно обновлять придётся).
- Убедитесь, что вашему service account выданы нужные роли.

### 1) Найдите `FOLDER_ID`
1. Откройте Yandex Cloud Console.
2. Выберите нужный каталог (Catalog).
3. Скопируйте `Folder ID` (обычно виден в URL вида `/folders/<FOLDER_ID>`).

### 2) Выберите модель для YandexGPT (Foundation Models)
1. В Yandex Cloud откройте раздел **Foundation Models / YandexGPT** (или аналогичный).
2. Выберите модель уровня `latest` (например, GPT Lite / подходящая для извлечения структурированных данных).
3. На странице модели найдите/сформируйте `modelUri` вида:
   - `gpt://<FOLDER_ID>/yandexgpt/latest`
   - (точная строка может чуть отличаться в зависимости от модели в интерфейсе — берите ту, что показывает консоль)

### 3) Дайте сервис-аккаунту доступ (IAM роли)
Вам нужны роли, чтобы вы могли вызывать:
- Foundation Models / YandexGPT:
  - обычно: `ai.languageModels.user`
- Vision/OCR:
  - обычно: `ai.vision.user`

Как выдать:
1. Откройте ваш service account.
2. В разделе IAM добавьте роли в нужном каталоге (folder).

### 4) Получите IAM token (как именно делаем в Edge Function)
Edge Function будет уметь:
1) взять service account private key;
2) подписать JWT (PS256);
3) обменять JWT на IAM token через:
   - `POST https://iam.api.cloud.yandex.net/iam/v1/tokens`

Если хотите проверить вручную (опционально), сначала можно сделать token через консоль/CLI, а затем подставить в запрос:
- Заголовок: `Authorization: Bearer <IAM_TOKEN>`

### 5) Какие эндпоинты использовать

#### 5.1 YandexGPT / Foundation Models (текст, синхронно)
Эндпоинт:
`POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion`

Заголовки:
- `Authorization: Bearer <IAM_TOKEN>`
- `Content-Type: application/json`

Минимальный body-формат:
```json
{
  "modelUri": "gpt://<FOLDER_ID>/yandexgpt/latest",
  "completionOptions": { "stream": false, "temperature": 0.2, "maxTokens": 800 },
  "messages": [
    { "role": "user", "text": "Извлеки JSON ..." }
  ]
}
```

#### 5.2 Vision OCR (batchAnalyze)
Эндпоинт OCR:
`POST https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze`

Обычно используется `TEXT_DETECTION` (распознавание текста):
- в `analyze_specs` передайте изображение (обычно base64) и `features` с `type: "TEXT_DETECTION"`.

Важно: аутентификация для Vision в примерах часто бывает `Authorization: Api-Key <API_KEY>`.
Чтобы держать всё безопасно, в нашей архитектуре Vision будет вызываться **из Edge Function** и аутентификация будет настраиваться по вашим секретам.

### 6) Переменные окружения (для Supabase Edge Functions)
Добавьте Supabase Secrets (или env для функций) со следующими именами (рекомендуемый набор):
- `YANDEX_FOLDER_ID`
- `YANDEX_IAM_SERVICE_ACCOUNT_ID`
- `YANDEX_IAM_SERVICE_ACCOUNT_KEY_ID` (keyId/kid из JSON-ключа)
- `YANDEX_IAM_SERVICE_ACCOUNT_PRIVATE_KEY` (private_key из JSON-ключа, с переводами строк)

Опционально:
- `YANDEX_GPT_MODEL_URI` (если хотите хранить точную строку `modelUri` отдельно)
- `YANDEX_VISION_API_KEY` (если решите аутентифицировать Vision через Api-Key)

### 7) Как это ляжет на ваш проект `koshel`
- Мобильное приложение уже имеет `src/lib/yandex.ts`, но для безопасности мы его **не будем использовать напрямую из клиента**.
- Все запросы YandexGPT/Vision отправятся в Supabase Edge Functions, а мобильное приложение будет вызывать их через HTTPS.

