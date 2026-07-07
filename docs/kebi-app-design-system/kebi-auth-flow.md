# Auth Flow

Kebi has two auth paths: **Google OAuth / Apple Sign-In** (social) and **email or phone OTP** (passwordless). No password creation, no email verification, no captcha. Friction kills signup.

## Login screen

One screen. Three options stacked top to bottom: Google, Apple, and a single smart input for email or phone. Tap "send me a code" → goes to OTP verification.

## Smart input behavior

Single text field with placeholder `email or phone number`. Detection happens on input change:

| User types | Detected as | Meta hint shown |
|---|---|---|
| Contains `@` | email | ✉️ looks like an email |
| Starts with `+` or only digits/spaces/dashes | phone | 📞 looks like a phone number |
| Empty | none | no meta hint |
| Anything else | ambiguous | no meta hint, validation kicks in on submit |

The meta hint sits inside the same `.input-wrap` container as the input, separated by a 1px hairline. Same pattern as the save sheet "looks like a tiktok link." Updates live as the user types.

On submit, route to OTP screen with channel parameter (`email` or `phone`).

## OTP verification screen

Same layout for both channels. Three copy strings swap based on channel:

| Element | Email path | Phone path |
|---|---|---|
| Hero title | check your email | check your messages |
| Subtitle | sent a 6-digit code to **you@email.com** | sent a 6-digit code to **+1 555 0123** |
| Change link | wrong email? **change it** | wrong number? **change it** |

Destination (email address or formatted phone number) is always bolded in the subtitle.

## OTP input behavior

6 single-digit boxes in a row. Each box:
- 44 × 56px, 12px border-radius
- Empty state: surface bg, no border
- Active state (focused): bg color, 1.5px text-color border
- Filled state: surface bg, 1.5px surface-2 border, 22px digit in bold
- `inputmode="numeric"`, `maxlength="1"` per box
- Auto-advance to next box on input
- Auto-back on backspace
- Paste handling: if user pastes a 6-digit string, distribute across all boxes

iOS will auto-fill from incoming SMS thanks to `autocomplete="one-time-code"` on the container.

## Auto-submit

When all 6 boxes are filled, fire submit automatically. No "verify" button needed. If the code is wrong, shake the input row, clear the boxes, focus the first box.

## Resend cooldown

60-second timer. While counting: `didn't get it? resend in 0:42` (the countdown updates every second). When timer hits zero: `didn't get it? **resend**` (resend becomes a tap link). Tapping resend re-sends the code and restarts the 60s timer.

## Change link

Below the resend row. `wrong email? change it` or `wrong number? change it`. Tapping it (or the back button in the top bar) goes back to the login screen with the input pre-filled with their previous entry.

## Errors

| Case | Behavior |
|---|---|
| Wrong code | shake input row, clear all 6 boxes, focus first box, toast: "that's not the code" |
| Code expired | toast: "code expired — tap resend" |
| Too many attempts | toast: "too many tries — wait a minute" + disable input for 60s |
| Network error | toast: "couldn't reach us — try again" |
| Invalid email/phone format on login | shake input, no toast, just a red text-soft border for 800ms |

## Provider mapping

Google → Firebase Auth or Clerk → user record created on first sign-in.
Apple → required by App Store if you offer any other social login. Same auth backend.
Email/Phone OTP → magic code via Twilio (phone) or Resend/Postmark (email).

The auth provider is an implementation detail. The UI is identical regardless of which backend powers OTP delivery.
