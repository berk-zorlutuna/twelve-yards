# Software Verification Cases

Product: Twelve Yards (3D penalty shootout game)

This file is generated from `tests/run-verification.js`; edit the cases there and run `npm run verify`.

Each case verifies one or more software requirements from [02-software-requirements.md](02-software-requirements.md). Results of the latest run are in [04-software-verification-results.md](04-software-verification-results.md).

## Methods

- **Test**: executed automatically in headless Chromium by the runner. Cases that set up exact ball, keeper or glove positions do so through the game's verification interface (SWR-031) and step the simulation at a fixed rate, so they are repeatable. Cases that say "drag", "press" or "move the pointer" use real browser input events in real time.
- **Inspection (automated)**: the runner scans the source file.
- **Manual**: needs a person and real hardware; not executed by the runner.

Coordinates: x is metres right of the goal centre as the kicker sees it, y is metres above the ground, at the goal line. Screen positions are CSS pixels in a 1100×650 viewport unless stated.

## Cases

### SVC-001 Page loads and renders with three.js r128

- Verifies: SWR-001
- Method: Test

**Steps**

1. Open index.html at 1100×650.
2. Read the three.js revision, the canvas size and the script errors raised during load.

**Expected result**

- No script errors.
- three.js revision is 128.
- The canvas fills the viewport and has a WebGL context.

### SVC-002 Physical constants

- Verifies: SWR-002
- Method: Test

**Steps**

1. Read the constants through the verification interface.

**Expected result**

- Goal 7.32 m × 2.44 m, ball radius 0.11 m, penalty spot 11 m from the goal line, gravity 9.81 m/s².

### SVC-003 Start screen and kick-off

- Verifies: SWR-003, SWR-018, SWR-020, SWR-023
- Method: Test

**Steps**

1. Open the page and read the start screen.
2. Press "Kick off".
3. Read the HUD and game state.

**Expected result**

- Before start: overlay shown with title, both control instructions and a "Kick off" button; HUD hidden.
- After start: overlay hidden, HUD shown, it is the player's turn, score 0–0, phase "Kick 1 of 5 · Your kick".

### SVC-004 Shootout decision rule

- Verifies: SWR-004, SWR-005
- Method: Test

**Steps**

1. Load each kick history below into the game state and call the decision function.
2. G = goal, M = miss. You GGG / CPU MM → undecided. You GGG / CPU MMM → you. You MMM / CPU GGG → CPU. You GGGG / CPU GMM → you. You GGGMM / CPU GGGMM → undecided. You GGGMM+G / CPU GGGMM → undecided (unequal kicks). You GGGMM+G / CPU GGGMM+M → you. You GGGMM+M / CPU GGGMM+G → CPU. You GGGMM+G / CPU GGGMM+G → undecided.

**Expected result**

- Every history returns the winner stated in the steps.

### SVC-005 Full match decided inside five kicks

- Verifies: SWR-003, SWR-004, SWR-018, SWR-019, SWR-020, SWR-022, SWR-024
- Method: Test

**Steps**

1. Start a match and drive it through the normal turn flow with scripted outcomes: you score three, the CPU misses three.
2. Record who kicks, the phase label and the pips at each kick, and the result screen.

**Expected result**

- Kicks alternate starting with the player.
- The match ends after three kicks each.
- Result screen shows "You win", the score 3–0 and a "Play again" button; scoreboard shows 3 and 0.
- At the player's third kick the player pips read goal, goal, current, pending, pending.

### SVC-006 Sudden death and replay

- Verifies: SWR-005, SWR-019, SWR-020, SWR-024
- Method: Test

**Steps**

1. Play one scripted match to the end, then press "Play again".
2. Check the score and history are cleared.
3. Script the new match: both sides score all five; in sudden death you score and the CPU misses.

**Expected result**

- After "Play again": score 0–0, no kicks recorded, overlay hidden.
- The match continues past five kicks each and ends after six each.
- Phase label reads "Sudden death · Your kick" for the sixth kick, and the player pips show only the sudden-death kick.
- Result screen shows "You win", 6–5 and "sudden death".

### SVC-007 Defeat and early finish with unequal kicks

- Verifies: SWR-004, SWR-024
- Method: Test

**Steps**

1. Script a match: you miss three, the CPU scores three.
2. Script a second match: you score four, the CPU scores one then misses two.

**Expected result**

- First match: "You lose", 3–0, three kicks each.
- Second match: ends as soon as it is decided, after your fourth kick and the CPU's third; "You win", 4–1.

### SVC-008 Flick target mapping

- Verifies: SWR-006, SWR-007
- Method: Test

**Steps**

1. Start a match at 1100×650 and wait for the aim state.
2. Press at (550, 500) and drag to (610, 350) without releasing.
3. Read the aim marker position.

**Expected result**

- Reference length is min(650, 1.6 × 1100) = 650 px.
- Marker is visible at x = 15 × 60/650 = 1.385 m, y = 7.5 × 150/650 − 0.35 = 1.381 m (± 0.01 m).

### SVC-009 Flick acceptance

- Verifies: SWR-006
- Method: Test

**Steps**

1. In the aim state, drag 100 px downward and release.
2. Drag 20 px upward (3 % of the reference length) and release.
3. Drag 150 px upward and release.
4. While the ball is in flight, drag 150 px upward again.

**Expected result**

- The first two drags do not shoot: state stays "aim".
- The third drag shoots: state becomes "flight".
- The fourth drag is ignored: the ball's flight is not restarted.

### SVC-010 Flick speed sets shot power

- Verifies: SWR-008
- Method: Test

**Steps**

1. Record the time of each pointer move made on the canvas while the button is held.
2. Drag (550, 500)→(610, 350) in two pointer moves, as fast as the input driver allows, and release; compute flight time as 11 m ÷ forward speed.
3. Reset to the aim state and repeat the same drag in ten moves over about 0.7 s or more.
4. Reset; dispatch the same flick as pointer events within one millisecond.

**Expected result**

- For both real drags the flight time equals the specified formula applied to the recorded drag: v = (path ÷ 650 px) ÷ duration, p = clamp((v − 0.35) ÷ 1.55, 0, 1), T = 1.05 − 0.63 p (± 0.01 s).
- The fast drag gives a shorter flight time than the slow drag; the slow drag gives more than 0.90 s.
- The instantaneous flick gives 0.42 s (full power).

### SVC-011 Bent flick curls the ball

- Verifies: SWR-009
- Method: Test

**Steps**

1. Drag straight up (550, 500)→(550, 350), release, read the lateral acceleration.
2. Reset; drag (550, 500)→(600, 425)→(550, 350), a 50 px bulge to the right, release, read the lateral acceleration.
3. Reset; drag with a 200 px bulge to the left.

**Expected result**

- Straight flick: 0 m/s².
- Right bulge of 50 px: −110 × 50/650 = −8.46 m/s² (± 0.05).
- Large left bulge: limited to +9 m/s².

### SVC-012 Touch-type pointer input (emulated)

- Verifies: SWR-006
- Method: Test

**Steps**

1. In the aim state, dispatch pointerdown, pointermove and pointerup events of pointerType "touch" on the canvas describing a 150 px upward flick.

**Expected result**

- The flick shoots: state becomes "flight".

### SVC-013 Launch reaches the aimed point

- Verifies: SWR-010
- Method: Test

**Steps**

1. With collisions disabled, launch the ball at each (x, y, flight time, curl): (0, 1.2, 0.42, 0), (3.3, 2.2, 0.5, 0), (−3.3, 0.3, 0.8, 0), (2, 1, 1.05, 0), (2.5, 1.5, 0.6, 6), (−3, 2, 0.45, −9).
2. Step the simulation at 240 Hz and record where and when the ball crosses the goal line.

**Expected result**

- Crossing point within 0.10 m of the aimed point in x and y for every launch.
- Crossing time within 0.02 s of the requested flight time.

### SVC-014 Goal detection and banner

- Verifies: SWR-011, SWR-021, SWR-030
- Method: Test

**Steps**

1. Player kick aimed at (2.0, 1.0) with the keeper standing at x = −3.
2. Continue the simulation for 3 s after the goal.
3. CPU kick aimed at (2.0, 1.0) with the gloves at (−3, 0.5).

**Expected result**

- Player kick: exactly one result recorded, a goal; banner "Goal!" with the launch speed × 3.6 rounded, in km/h.
- Afterwards the ball stays inside the net (z ≥ −1.85 m, |x| ≤ 3.66 m, y ≤ 2.44 m).
- CPU kick: a goal; banner "They score".

### SVC-015 Woodwork

- Verifies: SWR-012, SWR-021
- Method: Test

**Steps**

1. Player kick aimed at the right post (3.66, 1.0), keeper away.
2. Player kick aimed at the crossbar (0, 2.44), keeper away.

**Expected result**

- Both: one result recorded, not a goal; ball rebounds toward the pitch (forward speed reversed).
- Banners "Off the post" and "Off the bar".

### SVC-016 Off-target shots

- Verifies: SWR-013, SWR-021
- Method: Test

**Steps**

1. Player kick aimed wide at (4.5, 1.0).
2. Player kick aimed over at (0, 3.2).
3. CPU kick aimed wide at (4.5, 1.0).

**Expected result**

- None is a goal.
- Banners "Wide", "Over the bar", and for the CPU "Wide" with "They miss".

### SVC-017 Saves

- Verifies: SWR-014, SWR-021
- Method: Test

**Steps**

1. Player kick at (1.2, 1.1) with the keeper's hands at (1.0, 1.0): 0.22 m from the ball.
2. Player kick at (1.0, 0.4) with the keeper standing at x = 1.3 and hands at 2.25 m: 0.30 m from the body, 1.87 m from the hands.
3. Player kick at (1.75, 1.0) with the keeper's hands at (1.0, 1.0): 0.75 m away.
4. CPU kick at (−1.8, 1.4) with the gloves at (−2.0, 1.5): 0.22 m away.
5. CPU kick at (−1.8, 1.4) with the gloves at (−1.1, 1.4): 0.70 m away.

**Expected result**

- Kicks 1, 2 and 4 are saved: no goal, ball deflected back toward the pitch; banners "Saved", "Saved", "What a save!".
- Kicks 3 and 5 are goals.

### SVC-018 One result per kick and turn hand-over delay

- Verifies: SWR-003, SWR-022
- Method: Test

**Steps**

1. Take a player kick that scores.
2. Advance the game clock in 1/60 s steps until the turn changes.

**Expected result**

- Exactly one result is recorded for the kick.
- The turn passes to the CPU 2.1 s (± 0.05 s) after the result.

### SVC-019 CPU goalkeeper reaction and speed

- Verifies: SWR-015
- Method: Test

**Steps**

1. With 0, 5 and 12 player kicks already taken, take a full-power player shot at (3.3, 2.2) and read the keeper's reaction delay.
2. For the first shot, step the game at 120 Hz and record the keeper's hand movement per step.

**Expected result**

- Reaction delay = max(0.15, 0.235 − 0.008 × kicks taken): 0.235 s, 0.195 s, 0.150 s.
- Hands do not move before the delay elapses.
- After it, hand speed never exceeds 5.6 m/s.

### SVC-020 Glove steering

- Verifies: SWR-016
- Method: Test

**Steps**

1. Start the CPU's turn and hold it before the run-up.
2. Move the pointer to (300, 300) and wait 1 s.
3. Move the pointer to the far screen corner (1095, 5); 120 ms later read how far the gloves moved; wait 1.5 s and read the glove position.

**Expected result**

- After the first move the gloves sit on the pointer's point in the goal plane.
- Glove travel in the 120 ms window corresponds to at most 9 m/s.
- At the corner the gloves stop at the limits |x| = 3.9 m, y = 2.75 m.

### SVC-021 CPU kick sequence

- Verifies: SWR-017
- Method: Test

**Steps**

1. Start the CPU's turn five times in real time.
2. Each time wait for the run-up and then the kick; read the ball's forward speed and curl, and which figures are shown.

**Expected result**

- State goes wait → run-up → flight without input.
- Flight time 11 m ÷ forward speed is between 0.50 s and 0.74 s; |curl| ≤ 6 m/s².
- The kicker and the gloves are shown; the CPU goalkeeper is hidden.

### SVC-022 Sound control

- Verifies: SWR-025
- Method: Test

**Steps**

1. Before starting, read whether an audio context exists.
2. Press "Kick off"; read it again.
3. Press the sound button twice, reading its label, pressed state and the master gain each time.

**Expected result**

- No audio context before the first button press; one exists after "Kick off" with gain 1.
- First press: label "Sound off", aria-pressed "true", gain 0.
- Second press: label "Sound on", aria-pressed "false", gain 1.

### SVC-023 Goal stays in view at each screen shape

- Verifies: SWR-026
- Method: Test

**Steps**

1. For viewports 1100×650, 390×844 (phone portrait), 844×390 (phone landscape), 1024×768 (iPad landscape) and 768×1024 (iPad portrait): start a match, select the shooting camera and then the goalkeeping camera.
2. Project the four corners of the goal mouth to the screen in each view.
3. Measure the page width against the viewport width.

**Expected result**

- All four goal corners lie inside the viewport in both views at all five sizes.
- The page is not wider than the viewport (no horizontal scrolling).

### SVC-024 3D unavailable

- Verifies: SWR-027
- Method: Test

**Steps**

1. Open the page with the three.js request blocked.

**Expected result**

- A message stating that WebGL is needed is shown.
- The start overlay is hidden, so the game cannot be started.

### SVC-025 Reduced motion

- Verifies: SWR-028
- Method: Test

**Steps**

1. Open the page with the reduced-motion preference on; sample the camera's sideways position on the start screen over 1.2 s; score a goal and read the banner animation.
2. Repeat with the preference off.

**Expected result**

- Preference on: camera stays at x = 0 and the banner has no animation.
- Preference off: camera drifts sideways and the banner uses the "pop" animation.

### SVC-026 No stored data, no other network use (run time)

- Verifies: SWR-029
- Method: Test

**Steps**

1. Open the page, start a match, take a kick and let the CPU take one.
2. List every network request the page made, and read the page's local storage, session storage and cookies.

**Expected result**

- Requests go only to the page itself, cdnjs.cloudflare.com (three.js) and fonts.googleapis.com / fonts.gstatic.com.
- Storage and cookies are empty.

### SVC-027 Single file and external references (inspection)

- Verifies: SWR-001, SWR-029, SWR-031
- Method: Inspection (automated)

**Steps**

1. Scan index.html for every http(s) URL and for use of storage or network APIs.
2. Check the verification interface is the only global the game defines.

**Expected result**

- The only URLs are the three.js r128 script on cdnjs and the Google Fonts stylesheet.
- No use of localStorage, sessionStorage, document.cookie, fetch, XMLHttpRequest, WebSocket or sendBeacon.
- The game assigns exactly one global, window.__twelveYards.

### SVC-028 Ground bounce

- Verifies: SWR-030
- Method: Test

**Steps**

1. With collisions disabled, drop the ball from 1 m at rest and step at 240 Hz until it rebounds.

**Expected result**

- Upward speed after the bounce is 0.45 × the downward speed before it (± 0.02).
- The ball never goes below its radius (0.11 m).

### SVC-029 Sound is audible and appropriate

- Verifies: SWR-025
- Method: Manual

**Steps**

1. Play a match with speakers on.
2. Listen for the whistle before each kick, the kick, the crowd reaction to goals and saves, and the woodwork sound.
3. Mute and confirm silence.

**Expected result**

- Each event produces its sound; nothing plays while muted.

### SVC-030 Play on a physical phone

- Verifies: SWR-006, SWR-016, SWR-026
- Method: Manual

**Steps**

1. Open the game on an iOS and an Android phone, in portrait and landscape.
2. Play a full match using touch only.

**Expected result**

- Flicks shoot, the gloves follow the finger, the page does not scroll or zoom while playing, and all HUD text is readable.

### SVC-031 Frame rate on target devices

- Verifies: SWR-001
- Method: Manual

**Steps**

1. Play on a mid-range phone and a laptop with integrated graphics; observe frame rate with the browser's performance tools.

**Expected result**

- Play stays at or above 30 frames per second.

### SVC-032 iPad emulation: touch play without browser gestures

- Verifies: SWR-026, SWR-032
- Method: Test

**Steps**

1. Open the page with the browser emulating an iPad Pro 11 (touch, iPad user agent, 2× pixel ratio), in portrait (834×1194) and landscape (1194×834).
2. Tap "Kick off" and wait for the aim state.
3. Dispatch a touchmove and a contextmenu event on the canvas and a gesturestart event on the document; read whether each was cancelled.
4. Dispatch a touch-type flick; read the game state.
5. Read the page size, the canvas touch-action and the goal-corner positions in both camera views.

**Expected result**

- No script errors.
- touchmove, contextmenu and gesturestart are all cancelled, so Safari cannot scroll, show the long-press menu or pinch-zoom during play.
- The flick shoots.
- The canvas has touch-action "none"; the page is not larger than the viewport in either direction.
- All four goal corners are inside the viewport in both views.

### SVC-033 Home Screen installation metadata (inspection)

- Verifies: SWR-033
- Method: Inspection (automated)

**Steps**

1. Read the head of index.html.
2. Parse manifest.webmanifest.
3. Read the pixel size of each icon file it names.

**Expected result**

- The viewport declares viewport-fit=cover, maximum-scale=1 and user-scalable=no.
- The page declares apple-mobile-web-app-capable "yes", a status-bar style, an app title, a manifest link and a 180×180 apple-touch-icon.
- The manifest has the name "Twelve Yards", display "fullscreen", a start URL, and 180×180 and 512×512 PNG icons that exist at those sizes.
- The HUD and start screen are inset by the device safe areas.

### SVC-034 Recovery after backgrounding

- Verifies: SWR-034
- Method: Test

**Steps**

1. Start a match. Suspend the audio context, as iPadOS does when the app goes to the background.
2. Touch the pitch once; read the audio context state.
3. Sample the rendered picture low on the canvas, a quarter of the way across.
4. Force the WebGL context to be lost, then restored, as iPadOS does under memory pressure.
5. Sample the picture again and check the game clock is advancing.

**Expected result**

- Audio state goes suspended → running after the touch.
- Before the loss the sampled pixel is pitch green.
- After restoration the context is valid, the game clock advances and the sampled pixel is pitch green again.
- No script errors.

### SVC-035 Play on a physical iPad

- Verifies: SWR-026, SWR-032, SWR-033, SWR-034
- Method: Manual

**Steps**

1. Open the hosted game in Safari on an iPad, in portrait and landscape. Play a full match by touch.
2. Try to pinch, double-tap and long-press on the pitch, and to drag the page.
3. Use Share → Add to Home Screen, open the game from its icon and play a match.
4. Switch to another app and back during a match.

**Expected result**

- Flicks shoot and the gloves follow the finger; the page never zooms, scrolls or shows a menu.
- From the Home Screen the game opens full screen with its own icon and name, and the HUD is clear of the status bar and home indicator.
- After returning from another app the picture is intact and sound returns on the next touch.

## Coverage of software requirements

| Requirement | Verified by |
|---|---|
| SWR-001 | SVC-001, SVC-027, SVC-031 (manual) |
| SWR-029 | SVC-026, SVC-027 |
| SWR-031 | SVC-027 |
| SWR-003 | SVC-003, SVC-005, SVC-018 |
| SWR-004 | SVC-004, SVC-005, SVC-007 |
| SWR-005 | SVC-004, SVC-006 |
| SWR-022 | SVC-005, SVC-018 |
| SWR-006 | SVC-008, SVC-009, SVC-012, SVC-030 (manual) |
| SWR-007 | SVC-008 |
| SWR-008 | SVC-010 |
| SWR-009 | SVC-011 |
| SWR-010 | SVC-013 |
| SWR-002 | SVC-002 |
| SWR-011 | SVC-014 |
| SWR-012 | SVC-015 |
| SWR-013 | SVC-016 |
| SWR-014 | SVC-017 |
| SWR-030 | SVC-014, SVC-028 |
| SWR-015 | SVC-019 |
| SWR-017 | SVC-021 |
| SWR-016 | SVC-020, SVC-030 (manual) |
| SWR-018 | SVC-003, SVC-005 |
| SWR-019 | SVC-005, SVC-006 |
| SWR-020 | SVC-003, SVC-005, SVC-006 |
| SWR-021 | SVC-014, SVC-015, SVC-016, SVC-017 |
| SWR-023 | SVC-003 |
| SWR-024 | SVC-005, SVC-006, SVC-007 |
| SWR-026 | SVC-023, SVC-030 (manual), SVC-032, SVC-035 (manual) |
| SWR-032 | SVC-032, SVC-035 (manual) |
| SWR-033 | SVC-033, SVC-035 (manual) |
| SWR-034 | SVC-034, SVC-035 (manual) |
| SWR-025 | SVC-022, SVC-029 (manual) |
| SWR-027 | SVC-024 |
| SWR-028 | SVC-025 |
