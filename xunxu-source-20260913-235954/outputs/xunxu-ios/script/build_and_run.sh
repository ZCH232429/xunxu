#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
case "${1:-start}" in
  --help) echo 'Start Expo Go: ./script/build_and_run.sh [--web|--tunnel|--dev-client]' ;;
  --dev-client) exec npx expo start --dev-client ;;
  start) exec npx expo start --go ;;
  *) exec npx expo start --go "$@" ;;
esac
