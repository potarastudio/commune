#!/bin/sh
# Archives the iPhone app against production and uploads it to TestFlight.
#
#   pnpm testflight
#
# Signing is automatic: the Apple account signed in to Xcode (Settings >
# Accounts) makes or reuses the Apple Distribution certificate and the App
# Store profile for team 7R59U6AY8A. The app must already exist in App Store
# Connect with the bundle ID com.potarastudio.commune.
#
# Every upload needs a new build number, so it is the UTC minute of the
# archive and always goes up. Testers see MARKETING_VERSION from the Xcode
# project (1.0.0) with that build number beside it.
set -eu
cd "$(dirname "$0")/.."

# The URL is baked in at sync time; a TestFlight build always points at production.
unset COMMUNE_MOBILE_URL
pnpm exec cap sync ios

BUILD=$(date -u +%Y%m%d%H%M)
OUT="build/testflight/$BUILD"

xcodebuild archive \
  -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$OUT/Commune.xcarchive" \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD"

xcodebuild -exportArchive \
  -archivePath "$OUT/Commune.xcarchive" \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$OUT/export" \
  -allowProvisioningUpdates

echo "Uploaded build $BUILD. It shows in App Store Connect > TestFlight once Apple has processed it, usually within half an hour."
