# Implementation Plan - Smart Call Permission & Banner Removal

Remove automatic app-opening notification banner and transition to a context-aware, polished Pre-Call Permission modal when initiating or answering calls.

## Proposed Changes

### 1. Disable Automatic App-Launch Notification Banner
- Update `src/components/NotificationPermissionBanner.tsx` so it no longer auto-prompts on first user touch/click or renders an aggressive banner on initial open.
- Keep the component safe/no-op so any existing references in layout continue without runtime issues or intrusive popups.

### 2. Implement Polished Pre-Call Permission Modal in `src/components/call/VoiceCallPermissionModal.tsx`
- Create a dedicated dialog component with:
  - Clear explanation: Audio/Microphone & Notification access required for calling and ring reception.
  - One-tap "অনুমতি দিন ও কল শুরু করুন" (Grant & Proceed) button.
  - Graceful fallback: User can cancel without breaking the UI.
  - Remembers user decision in `localStorage` so they aren't asked repeatedly once granted.

### 3. Integrate Pre-Call Permission into `src/context/CallContext.tsx`
- Before `startCall(...)` proceeds:
  - Check if audio permissions or notification state are ready.
  - If microphone permission is missing or needs interaction, open the Pre-Call Permission Modal.
  - Once granted, seamlessly initiate the call.
- Provide a clean experience with no unwanted popups when simply opening the app.

## Verification Plan
- Run `compile_applet` to ensure full TypeScript compilation without regressions.
- Verify that opening the app doesn't trigger permission banners or click listeners.
- Verify calling actions smoothly prompt the permission modal if microphone/audio access is needed.
