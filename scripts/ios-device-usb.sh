#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-127.0.0.1}"
# Xcode 26: Metal toolchain ломает Swift-линковку (SwiftUICore).
export TOOLCHAINS="${TOOLCHAINS:-com.apple.dt.toolchain.XcodeDefault}"

CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
TEAM_ID="${IOS_DEVELOPMENT_TEAM:-2FXLXGLR39}"
unset __EXPO_EAGER_BUNDLE_OPTIONS
cd "$ROOT"

if [[ -d "$ROOT/ios" ]]; then
  echo "→ pod install (нативные модули Expo)…"
  (cd "$ROOT/ios" && pod install)
fi

resolve_device_udid() {
  if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
    echo "$IOS_DEVICE_ID"
    return
  fi

  xcrun xctrace list devices 2>&1 \
    | grep -E "^iPhone" \
    | grep -v Simulator \
    | head -1 \
    | sed -E 's/.* \(([0-9A-F-]+)\)$/\1/'
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
  app_path="$(
    find "$HOME/Library/Developer/Xcode/DerivedData" \
      -path "*/Build/Products/${CONFIGURATION}-iphoneos/koshel.app" \
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
  if xcrun devicectl device install app --device "$udid" "$app_path" 2>/dev/null; then
    return 0
  fi
  # Fallback for older Xcode toolchains
  if command -v ios-deploy >/dev/null 2>&1; then
    ios-deploy --id "$udid" --bundle "$app_path" --justlaunch
    return 0
  fi
  echo "Установите вручную из Xcode (Product → Run) или: xcrun devicectl device install app --device $udid \"$app_path\""
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
  echo "→ iPhone не найден — запускаем expo run:ios…"
  npx expo run:ios --device
  exit $?
fi

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
if [[ "$CONFIGURATION" == "Release" ]]; then
  echo "Откройте приложение — Metro не нужен."
  echo "«Поделиться» из банка: Koshel появится после установки этой сборки."
else
  echo "Debug: перед запуском нужен Metro (npm run start:iphone-usb)."
fi
