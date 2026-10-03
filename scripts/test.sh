#!/usr/bin/env bash
# Runs the app's logic tests (tests/*.test.mjs). For the database tests, see scripts/test-db.sh.
#
# These commands live here rather than in package.json "scripts", because Expo's runtime fingerprint
# includes package.json scripts: changing them would stop over-the-air updates reaching installed builds.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --no-warnings --experimental-strip-types --test tests/*.test.mjs
