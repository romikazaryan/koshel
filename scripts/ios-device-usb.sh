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

list_connected_named() {
  # Человекочитаемый список реально подключённых устройств (имя + UDID),
  # строго из секции "== Devices ==" xctrace.
  xcrun xctrace list devices 2>/dev/null \
    | awk '
        /^== Devices ==/ { s=1; next }
        /^== / { s=0 }
        s
      ' \
    | grep -E '\([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}\)'
}

device_reachable_via_devicectl() {
  # На современных iPhone (CoreDevice) xctrace часто помечает устройство как
  # offline, хотя devicectl с ним прекрасно работает. Поэтому достижимость
  # проверяем именно через devicectl — он принимает и аппаратный UDID.
  local udid="$1"
  [[ -n "$udid" ]] || return 1
  xcrun devicectl device info details --device "$udid" >/dev/null 2>&1
}

resolve_device_udid() {
  # Жёсткая фиксация устройства имеет наивысший приоритет.
  if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
    echo "$IOS_DEVICE_ID"
    return
  fi

  local connected
  connected="$(list_connected_udids)"

  # По умолчанию — СТРОГО основной телефон (iPhone (3)).
  # Считаем его доступным, если он онлайн в xctrace ИЛИ достижим через devicectl.
  # Это защищает от тихой установки на чужой подключённый телефон.
  if grep -qx "$PREFERRED_DEVICE_ID" <<<"$connected" \
    || device_reachable_via_devicectl "$PREFERRED_DEVICE_ID"; then
    echo "$PREFERRED_DEVICE_ID"
    return
  fi

  # iPhone (3) не доступен. Падаем (пустой вывод), если явно не разрешили
  # ставить на любое устройство через ALLOW_ANY_DEVICE=1.
  if [[ "${ALLOW_ANY_DEVICE:-0}" == "1" ]]; then
    head -1 <<<"$connected"
  fi
}

build_with_provisioning_updates() {
  local udid="$1"
  local destination="$2"
  echo "→ Сборка (${CONFIGURATION}) с обновлением provisioning profiles…"
  echo "  destination: $destination"
  echo "  (App Groups + Share Extension — нужен вход в Xcode / Apple ID)"

  local -a xcode_args=(
    -workspace "$ROOT/ios/koshel.xcworkspace"
    -scheme koshel
    -configuration "$CONFIGURATION"
    -destination "$destination"
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
  echo "✗ iPhone (3) не подключён (UDID $PREFERRED_DEVICE_ID)."
  echo "  Чтобы не поставить сборку по ошибке на ЧУЖОЙ телефон, установка остановлена."
  echo ""
  connected_named="$(list_connected_named || true)"
  if [[ -n "$connected_named" ]]; then
    echo "  Сейчас реально подключены другие устройства:"
    echo "$connected_named" | sed 's/^/    • /'
    echo ""
  else
    echo "  Реально подключённых устройств не найдено."
    echo ""
  fi
  echo "  Что сделать:"
  echo "    1. Подключите iPhone (3) кабелем (именно дата-кабелем, не «только зарядка»)."
  echo "    2. Разблокируйте экран и нажмите «Доверять этому компьютеру»."
  echo "    3. Проверьте, что он стал онлайн: xcrun devicectl list devices"
  echo "       (нужно состояние connected, а не «available/offline» по сети)."
  echo "    4. Запустите снова: npm run ios:release"
  echo ""
  echo "  Если действительно хотите поставить на другой подключённый телефон —"
  echo "    ALLOW_ANY_DEVICE=1 npm run ios:release"
  echo "  Либо зафиксируйте конкретный телефон: IOS_DEVICE_ID=<udid> npm run ios:release"
  exit 1
fi

if [[ "$DEVICE_UDID" == "$PREFERRED_DEVICE_ID" ]]; then
  echo "→ Целевое устройство: iPhone (3) ($DEVICE_UDID)"
else
  echo "→ Целевое устройство (НЕ iPhone (3)): $DEVICE_UDID"
fi

set +e
build_with_provisioning_updates "$DEVICE_UDID" "id=$DEVICE_UDID"
BUILD_STATUS=$?
set -e

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  # На CoreDevice-устройствах xcodebuild иногда не находит destination по id
  # (видит его «офлайн»), хотя devicectl ставит без проблем. Пробуем собрать
  # под generic iOS — установку всё равно сделает devicectl на нужный телефон.
  echo ""
  echo "→ destination по id не сработал, пробуем generic/platform=iOS…"
  set +e
  build_with_provisioning_updates "$DEVICE_UDID" "generic/platform=iOS"
  BUILD_STATUS=$?
  set -e
fi

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
