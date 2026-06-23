#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-127.0.0.1}"
# Xcode 26: Metal toolchain ломает Swift-линковку (SwiftUICore).
export TOOLCHAINS="${TOOLCHAINS:-com.apple.dt.toolchain.XcodeDefault}"

CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
TEAM_ID="${IOS_DEVELOPMENT_TEAM:-2FXLXGLR39}"
# Основной телефон для установки — iPhone (3). Можно переопределить через
# PREFERRED_DEVICE_ID или жёстко зафиксировать через IOS_DEVICE_ID.
PREFERRED_DEVICE_ID="${PREFERRED_DEVICE_ID:-00008130-00046C840A90001C}"
unset __EXPO_EAGER_BUNDLE_OPTIONS
cd "$ROOT"

if [[ -d "$ROOT/ios" ]]; then
  echo "→ pod install (нативные модули Expo)…"
  (cd "$ROOT/ios" && pod install)
fi

list_connected_udids() {
  # UDID физического iPhone имеет вид 00008130-00046C840A90001C (8 hex, дефис, 16 hex).
  # Этот формат не пересекается ни с Mac, ни с UUID симуляторов (8-4-4-4-12),
  # поэтому по нему можно надёжно выбрать именно реальное устройство.
  #
  # Берём только РЕАЛЬНО подключённые устройства (иначе xcodebuild не найдёт
  # destination и упадёт с кодом 70). Совмещаем два источника:
  #   1) devicectl — подключённые по USB и по сети;
  #   2) xctrace, но СТРОГО секция "== Devices ==" (подключённые), без
  #      "== Devices Offline ==" и "== Simulators ==" — на случай, если devicectl
  #      по какой-то причине устройство не отдал.
  {
    xcrun devicectl list devices 2>/dev/null \
      | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}'

    xcrun xctrace list devices 2>/dev/null \
      | awk '
          /^== Devices ==/ { s="connected"; next }
          /^== / { s="other"; next }
          s=="connected"
        ' \
      | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}'
  } | awk 'NF && !seen[$0]++'
}

resolve_device_udid() {
  # Жёсткая фиксация устройства имеет наивысший приоритет.
  if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
    echo "$IOS_DEVICE_ID"
    return
  fi

  local connected
  connected="$(list_connected_udids)"

  # Предпочитаем основной телефон (iPhone (3)), если он реально подключён.
  if [[ -n "$connected" ]] && grep -qx "$PREFERRED_DEVICE_ID" <<<"$connected"; then
    echo "$PREFERRED_DEVICE_ID"
    return
  fi

  # Иначе — первое реально подключённое устройство.
  head -1 <<<"$connected"
}

build_with_provisioning_updates() {
  local udid="$1"
  echo "→ Сборка (${CONFIGURATION}) с обновлением provisioning profiles…"
  echo "  (App Groups + Share Extension — нужен вход в Xcode / Apple ID)"

  local -a xcode_args=(
    -workspace "$ROOT/ios/koshel.xcworkspace"
    -scheme koshel
    -configuration "$CONFIGURATION"
    -destination "id=$udid"
    -allowProvisioningUpdates
    -allowProvisioningDeviceRegistration
    "DEVELOPMENT_TEAM=$TEAM_ID"
    COCOAPODS_PARALLEL_CODE_SIGN=true
    COMPILER_INDEX_STORE_ENABLE=NO
  )

  if [[ "$CONFIGURATION" == "Debug" ]]; then
    xcode_args+=(SKIP_BUNDLING=1)
  fi

  xcode_args+=(build)
  xcodebuild "${xcode_args[@]}"
}

find_built_app() {
  local app_path
  # ВАЖНО: исключаем Index.noindex — там лежит устаревший бандл от индексатора Xcode,
  # иначе на устройство уедет старая сборка.
  app_path="$(
    find "$HOME/Library/Developer/Xcode/DerivedData" \
      -path "*/Build/Products/${CONFIGURATION}-iphoneos/koshel.app" \
      -not -path "*/Index.noindex/*" \
      -type d 2>/dev/null \
      | head -1
  )"
  if [[ -z "$app_path" || ! -d "$app_path" ]]; then
    echo "Не найден koshel.app после сборки" >&2
    return 1
  fi
  echo "$app_path"
}

install_on_device() {
  local udid="$1"
  local app_path="$2"
  echo "→ Установка на iPhone…"
  echo "  ($app_path)"
  if xcrun devicectl device install app --device "$udid" "$app_path"; then
    return 0
  fi
  # Fallback for older Xcode toolchains
  if command -v ios-deploy >/dev/null 2>&1; then
    ios-deploy --id "$udid" --bundle "$app_path" --justlaunch
    return 0
  fi
  echo "Не удалось установить автоматически. Вручную:" >&2
  echo "  xcrun devicectl device install app --device $udid \"$app_path\"" >&2
  return 1
}

print_signing_help() {
  cat <<'EOF'

Не удалось собрать: нужны provisioning profiles с App Groups.

Сделайте один раз в Xcode (ios/koshel.xcworkspace):
  1. Target «koshel» → Signing & Capabilities → Automatic signing, Team 2FXLXGLR39
     Добавьте App Groups: group.com.anonymous.koshel
  2. Target «KoshelShare» → то же + bundle id com.anonymous.koshel.share-extension
  3. Product → Clean Build Folder, затем снова npm run ios:release

Или на developer.apple.com:
  Identifiers → App Groups → создайте group.com.anonymous.koshel
  Identifiers → com.anonymous.koshel → включите App Groups
  Identifiers → com.anonymous.koshel.share-extension → App Groups

Примечание: push-уведомления требуют платную подписку Apple Developer ($99/год).
На бесплатном аккаунте они отключены в сборке — локальные уведомления в Expo Go не пострадают.

EOF
}

DEVICE_UDID="$(resolve_device_udid || true)"
if [[ -z "${DEVICE_UDID:-}" ]]; then
  echo "→ Подключённый iPhone не найден (devicectl/xctrace пусты)."
  echo "  Подключите iPhone (3) по USB, разблокируйте экран и нажмите «Доверять»."
  echo "  Передаём выбор устройства expo…"
  expo_args=(expo run:ios --device)
  # Важно: без этого фолбэк собирает Debug (нужен Metro), а мы хотим Release.
  if [[ "$CONFIGURATION" == "Release" ]]; then
    expo_args+=(--configuration Release)
  fi
  npx "${expo_args[@]}"
  exit $?
fi
echo "→ Целевое устройство: $DEVICE_UDID"

set +e
build_with_provisioning_updates "$DEVICE_UDID"
BUILD_STATUS=$?
set -e

  if [[ "$BUILD_STATUS" -ne 0 ]]; then
    echo ""
    echo "Сборка не удалась (код $BUILD_STATUS). Смотрите ошибки выше в логе xcodebuild."
    echo "Частые причины: ошибка в JS-бандле, подпись, App Groups для Share Extension."
    print_signing_help
    exit "$BUILD_STATUS"
  fi

APP_PATH="$(find_built_app)"
install_on_device "$DEVICE_UDID" "$APP_PATH"

echo ""
echo "✓ koshel установлен на iPhone."
echo ""
echo "Если при первом запуске видите «Ненадёжный разработчик» / приложение не"
echo "открывается (invalid code signature / profile not trusted) — это нормально"
echo "для бесплатного Apple ID. Один раз доверьтесь профилю на самом телефоне:"
echo "  Настройки → Основные → VPN и управление устройством →"
echo "  Разработчик «Apple Development: …» → «Доверять»."
if [[ "$CONFIGURATION" == "Release" ]]; then
  echo ""
  echo "Откройте приложение — Metro не нужен."
  echo "«Поделиться» из банка: Koshel появится после установки этой сборки."
else
  echo ""
  echo "Debug: перед запуском нужен Metro (npm run start:iphone-usb)."
fi
