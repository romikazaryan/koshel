# Вход в аккаунт (Supabase Auth)

## Проблема: ссылка из письма открывает `localhost:3000`

Это **не ошибка приложения на телефоне**. Supabase после подтверждения перенаправляет на **Site URL** из настроек. Сейчас там, скорее всего, `http://localhost:3000` — на iPhone это «компьютер разработчика», его там нет → «Страница недоступна».

### Вариант А — проще всего (рекомендуем для старта)

Подтверждение почты **не требуется**:

1. Supabase → **Authentication** → **Providers** → **Email**
2. Выключить **Confirm email** (подтверждение по ссылке)
3. Сохранить

Регистрация: email + пароль → сразу можно войти. Письмо с ссылкой не нужно.

### Вариант Б — оставить подтверждение по почте

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL:** `koshel://auth/callback`
3. **Redirect URLs** — добавить строки (каждая с новой строки):
   ```
   koshel://auth/callback
   koshel://**
   com.anonymous.koshel://auth/callback
   com.anonymous.koshel://**
   ```
4. Сохранить
5. Пересобрать приложение на iPhone: `npm run ios:release`
6. Зарегистрироваться **заново** (новое письмо уже с правильной ссылкой)
7. Ссылку из письма открыть на **том же iPhone** — должно открыться приложение **koshel**

---

## Email (базовые настройки)

1. **Authentication** → **Providers** → **Email** → включить
2. Для теста: **Confirm email** — выкл. (см. вариант А выше)

---

## Телефон (SMS) — нужен Twilio

Supabase **сам SMS не шлёт**. Нужен платёжный/тестовый аккаунт **Twilio** (есть бесплатный trial).

Поля на скрине — из кабинета [twilio.com](https://www.twilio.com):

| Поле в Supabase | Где взять в Twilio |
|-----------------|-------------------|
| Account SID | Console → Account Info |
| Auth Token | Console → Account Info (Show) |
| Message Service SID | Messaging → Services → создать Service → скопировать SID |

Порядок:

1. Зарегистрироваться в Twilio, подтвердить аккаунт
2. Купить/получить номер для SMS (trial — на ограниченные номера)
3. **Messaging** → **Services** → Create Messaging Service → добавить номер
4. Скопировать **Messaging Service SID** (начинается с `MG...`)
5. В Supabase → **Phone** → Twilio → вставить три поля → **Save**
6. В приложении: вкладка **Телефон** → номер `9001234567` → код из SMS

**Пока Twilio не настроен:** в Supabase **выключите** Phone provider и пользуйтесь **Email**.

---

## Миграции базы

```bash
cd /Users/romik/Desktop/koshel
npx supabase db push
```

## Пересборка приложения

```bash
npm run ios:release
```

## Проверка

- Email: регистрация → вход (с Confirm email выкл. — без письма)
- Телефон: только после Twilio
- **Выйти** → снова экран входа
