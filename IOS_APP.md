# NouriScan for iOS

The iOS app is the existing React frontend wrapped in [Capacitor](https://capacitorjs.com),
with real native capability layered on top. One codebase serves both
`nouriscan.app` and the App Store build.

---

## Why Capacitor, and the one thing that could get us rejected

**App Store Guideline 4.2 (Minimum Functionality)** rejects apps that are just a
website in a webview. This build avoids that in two specific ways, and both must
stay true:

1. **Web assets are bundled, not remote.** `capacitor.config.json` deliberately
   has no `server.url`. The contents of `dist/` ship inside the `.ipa` and are
   served from `capacitor://localhost`. Pointing the webview at
   `https://nouriscan.app` instead would turn this into a wrapper and invite a
   rejection.
2. **The app does things the website cannot.** Live ML Kit barcode scanning,
   the native camera sheet, haptics, and storage that survives WKWebView
   eviction. Live barcode scanning is the strongest single argument here — lead
   with it in the review notes.

---

## Prerequisites

| Requirement | Status on this machine | How to get it |
|---|---|---|
| **Xcode** (full, not CLT) | ❌ Not installed | Mac App Store, ~10 GB. Then `sudo xcode-select -s /Applications/Xcode.app` |
| **CocoaPods** | ❌ Not installed | `brew install cocoapods` (or `sudo gem install cocoapods`) |
| **Apple Developer Program** | Check | [developer.apple.com/programs](https://developer.apple.com/programs/) — $99/yr, enrollment can take hours to a week |
| Node + npm | ✅ v20.20.2 | — |

> **npm proxy note.** `~/.npmrc` points npm at `sysproxy.wal-mart.com`, which
> only resolves on the Walmart network. `frontend/.npmrc` overrides that for
> this project via `noproxy`. Don't delete it or installs will hang off-VPN.

---

## First build

```bash
cd frontend
npm install
npm run build
npx cap sync ios
cd ios/App && pod install --repo-update && cd ../..
npx cap open ios
```

Then in Xcode, complete the steps under "Manual Xcode steps" below before building.

---

## Day-to-day loop

```bash
npm run ios:sync    # vite build + cap sync ios
npm run ios:open    # open the workspace in Xcode
```

Any change to React code needs `ios:sync` before it appears in the app — the
native project serves the built copy in `ios/App/App/public`, not `src/`.

---

## What's already done

**Native integration**
- `src/utils/platform.js` — platform detection, haptics, durable storage, native shell boot
- `src/utils/nativeScan.js` — native camera capture + live ML Kit barcode scanning
- `src/components/scanning/LiveBarcodeScanner.jsx` — branded full-screen scanner with reticle, torch, and permission fallbacks
- Photo OCR uses the native camera sheet on iOS and keeps the `<input type="file">` path on web
- Session token mirrors into Capacitor Preferences, so iOS storage eviction can't silently sign users out

**App Store compliance**
- `Info.plist` — camera and photo-library permission strings, ATS enforced, portrait-only, app-bound domains, `arm64` capability
- `PrivacyInfo.xcprivacy` — privacy manifest (mandatory since 2024)
- In-app account deletion — `DELETE /auth/account` + confirm UI (Guideline 5.1.1(v))
- Health disclaimer on first launch + persistent note in Profile (Guidelines 1.4.1 / 5.1.1(ix))
- Reviewer demo account via `REVIEW_EMAIL` / `REVIEW_OTP` (Guideline 2.1)
- App icon and splash, both opaque and correctly sized

**Backend correctness work this required**
- `children` and `scans` now carry `user_email`, so data follows the account rather than a browser-local session id. Reads fall back to `user_session` for pre-existing rows, so the live beta is unaffected.
- Closed IDOR holes: child read/update/delete, scan history, scan decisions, and the bot's child lookup were all unscoped and are now owner-checked.
- `/scan/ocr-image` now records a scan row, which fixes the permanently-zero `image_uploads` metric on the admin dashboard and makes photo scans appear in history.

---

## Manual Xcode steps

These need the Xcode UI and can't be scripted safely.

1. **Add the privacy manifest to the target.** `PrivacyInfo.xcprivacy` exists at
   `ios/App/App/` but is not yet a member of the App target. Drag it into the
   `App` group in the Xcode navigator, tick the **App** target, and confirm it
   appears under Build Phases → Copy Bundle Resources. *Missing this is a
   silent submission rejection.*

2. **Signing.** Target `App` → Signing & Capabilities → select your team, leave
   "Automatically manage signing" on.

3. **Bundle identifier.** Currently `app.nouriscan`. **This is permanent once
   the App Store Connect record exists** — change it now if you want something
   else.

4. **Version.** Set Marketing Version to `1.0.0` and Build to `1`.

---

## App Store Connect

**Before submitting, set these on the `nouri-scan-api` service in Render:**

```
REVIEW_EMAIL=appreview@nouriscan.app
REVIEW_OTP=<a random 8+ character code>
```

Without these the reviewer hits the invite gate and an OTP they cannot read,
and the app is rejected under Guideline 2.1. Unset both after approval.

### Review notes template

```
DEMO ACCOUNT
Email: appreview@nouriscan.app
Code:  <your REVIEW_OTP value>

No invite code is needed for this address. Enter the email, tap continue, then
enter the code above — it is accepted directly, no email is sent.

ABOUT THE APP
NouriScan reads packaged-food labels and returns a nutrition score personalised
to one child's age band, diet type, and allergens.

NATIVE FUNCTIONALITY (re: Guideline 4.2)
All web assets are bundled in the binary; the app does not load a remote site.
Native capability includes real-time ML Kit barcode scanning with torch control,
the native camera for label capture, haptic feedback, and native preference
storage.

TO TEST
1. Sign in with the demo account above
2. A child profile is already set up
3. Scan → "Scan Barcode" → live camera scanner (needs camera permission)
   Or type UPC 028000010019 (Honey Nut Cheerios) to test without the camera
4. Scan → "Photo Label" → photograph any nutrition panel

HEALTH DISCLAIMER
The app shows a disclaimer on first launch and states throughout that it
provides educational nutrition information, not medical advice. It makes no
diagnostic or treatment claims.

PRIVACY
Account email, the child profile (age band, diet, allergens), and scan history.
Label photos are processed for text and not retained. No tracking, no ads, no
third-party analytics. Account deletion is available in-app under Profile.
```

### Still needed before submission

- ~~**Privacy policy URL**~~ — ✅ written. Lives at `frontend/public/privacy.html`, served at
  **`https://nouriscan.app/privacy`** once deployed (`render.yaml` has the rewrite rule,
  which must stay *above* the SPA catch-all or it serves the React app instead).
  Linked from Profile in-app. Its declarations match `PrivacyInfo.xcprivacy` —
  keep the two in sync if either changes.
- **Support URL** — can be a simple page with a contact email.
- **`aanchalG@nouriscan.app` must actually receive mail.** It's the contact address in the
  privacy policy, in the App Store Connect support field, and in the app's invite-code
  help text. Apple may check it resolves. (Separate from the OTP *sending* address
  configured via `RESEND_FROM` — that one only sends.)
- **Screenshots** — 6.7" (1290×2796) and 6.5" (1242×2688) required. Capture from the simulator.
- **App Privacy answers** — must match `PrivacyInfo.xcprivacy` exactly. Declare: Email (linked), Health & Fitness (linked), Photos (not linked), Product Interaction (linked). Tracking: No.
- **Age rating** — 4+ is appropriate; there's no objectionable content.

---

## Known review risks, ranked

1. **Guideline 4.2, minimum functionality.** Mitigated by bundled assets and live
   scanning. If rejected anyway, the appeal is the ML Kit scanner, the native
   camera, and haptics — none of which the website can do.
2. **Guidelines 1.4.1 / 5.1.1(ix), medical claims.** An app scoring infant food
   gets scrutiny. Never describe a score as "safe" or "unsafe" in a medical
   sense. The existing framing — guidance, with a disclaimer — is the defence.
   The honey-under-12-months hard gate cites established public health guidance
   rather than making a novel claim, which is the right posture.
3. **Guideline 2.1, incomplete information.** Entirely about the reviewer demo
   account. Set the env vars.
4. **Guideline 5.1.1(v), account deletion.** Built. Verify it works end-to-end
   on a real device before submitting.

---

## Android

Capacitor makes this mostly free later:

```bash
npm install @capacitor/android
npx cap add android
```

The ML Kit barcode plugin needs one extra step on Android (the scanner module
is downloaded at runtime rather than bundled). Everything else carries over.
