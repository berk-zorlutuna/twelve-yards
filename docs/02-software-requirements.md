# Software Requirements

Product: Twelve Yards (3D penalty shootout game)

## 1. Purpose and scope

These requirements specify the software in `index.html`. Each one refines a system requirement from [01-system-requirements.md](01-system-requirements.md) and is verified by one or more cases in [03-software-verification-cases.md](03-software-verification-cases.md).

## 2. Conventions

- **Coordinates.** Metres. The goal line is z = 0 and the goal centre is x = 0. x increases to the kicker's right, y is height above the pitch, z increases from the goal toward the penalty spot.
- **Reference length.** For flick input, `ref` = min(viewport height, 1.6 × viewport width), in CSS pixels.
- **States.** `menu`, `wait` (before the whistle), `aim` (player may flick), `runup` (CPU approaching the ball), `flight`, `result`, `over`.
- **clamp(v, a, b)** limits v to the range a to b.

## 3. Requirements

### 3.1 Platform and structure

| ID | Requirement | Refines |
|---|---|---|
| SWR-001 | The software shall render the scene with WebGL through three.js release r128 on a canvas that fills the viewport, at a device pixel ratio of at most 2. | SYS-001, SYS-013 |
| SWR-029 | The game shall be one HTML file; the only other delivered files shall be the web app manifest and its icons. Its only external references shall be the three.js r128 script on cdnjs.cloudflare.com and a Google Fonts stylesheet. It shall not use browser storage or cookies, and shall make no network requests of its own. | SYS-013 |
| SWR-031 | The software shall expose one global object, `window.__twelveYards`, giving read access to game state and the ability to pause the frame loop and step the simulation, for automated verification. It shall define no other globals. | SYS-013 |

### 3.2 Match flow

| ID | Requirement | Refines |
|---|---|---|
| SWR-003 | A match shall start with the player's kick, and kicks shall alternate between the player and the CPU. | SYS-002 |
| SWR-004 | While neither side has completed more than five kicks and they have not both completed five, a side shall win as soon as its goals exceed the other side's goals plus the other side's remaining kicks out of five. | SYS-002 |
| SWR-005 | Once both sides have completed five kicks, a side shall win when both have taken the same number of kicks and their goals differ. Otherwise the match shall continue. | SYS-002 |
| SWR-022 | Each kick shall record exactly one result for the kicking side. The next kick, or the result screen, shall follow 2.1 s after the result. | SYS-002 |

### 3.3 Player's kick

| ID | Requirement | Refines |
|---|---|---|
| SWR-006 | A flick shall be accepted only in the `aim` state, from mouse or touch pointer events. On release the ball shall be kicked only if the pointer ended more than 0.05 × `ref` above where it started. | SYS-003, SYS-009 |
| SWR-007 | The aimed point on the goal plane shall be x = 15 × dx ÷ `ref` and y = max(0.15, 7.5 × dy ÷ `ref` − 0.35), where dx and dy are the pointer's rightward and upward displacement. While dragging, a marker shall show this point. | SYS-003 |
| SWR-008 | Shot power p shall be clamp((v − 0.35) ÷ 1.55, 0, 1), where v is the drag path length ÷ `ref`, divided by the drag duration in seconds measured from the first to the last pointer movement (minimum 0.05 s). The ball's flight time to the goal line shall be 1.05 − 0.63 p seconds, that is 1.05 s at no power and 0.42 s at full power. | SYS-003 |
| SWR-009 | Curl shall be a constant sideways acceleration of clamp(110 × b ÷ `ref`, −9, 9) m/s², where b is the largest perpendicular deviation of the drag path from the straight line between its ends, positive when the path bulges to the left. A path that bulges right therefore starts the ball right and curls it left. | SYS-003 |
| SWR-010 | The ball shall be launched from the penalty spot with the velocity that, under gravity and the curl acceleration and with nothing in the way, brings it to the aimed point on the goal line at the flight time. | SYS-006 |

### 3.4 Ball and results

| ID | Requirement | Refines |
|---|---|---|
| SWR-002 | The simulation shall use: goal width 7.32 m, goal height 2.44 m, ball radius 0.11 m, penalty spot 11 m from the goal line, gravity 9.81 m/s². | SYS-006 |
| SWR-011 | A kick shall be a goal when the ball's centre crosses the goal line with \|x\| < 3.66 m and y < 2.44 m, has not been saved, and does not strike the woodwork. | SYS-006 |
| SWR-012 | A kick shall be woodwork, not a goal, when the ball's centre crosses the goal line within 0.13 m of a post or of the crossbar. The ball shall rebound toward the pitch. | SYS-006 |
| SWR-013 | A kick that crosses the goal line otherwise shall be a miss, described as "Over the bar" when above the crossbar between the posts and "Wide" in all other cases. | SYS-006 |
| SWR-014 | A kick shall be a save when the ball reaches the goalkeeper's plane (z = 0.35 m) within reach. For the CPU goalkeeper, reach is 0.6 m from the hands or 0.42 m from the line between feet and hands. For the player, reach is 0.6 m from the gloves. A saved ball shall be deflected back toward the pitch and shall not count as a goal. | SYS-004, SYS-005, SYS-006 |
| SWR-030 | The ball shall not pass below the pitch. It shall bounce with a restitution of 0.45, and after a goal it shall remain inside the net. | SYS-006 |

### 3.5 Computer opponent

| ID | Requirement | Refines |
|---|---|---|
| SWR-015 | The CPU goalkeeper shall start moving its hands toward its chosen point after a reaction delay of max(0.15, 0.235 − 0.008 × n) seconds, where n is the number of kicks the player has already taken, and shall move them at no more than 5.6 m/s. | SYS-005 |
| SWR-017 | On its turn the CPU shall, without player input, wait, run up and kick. Its shot shall have a flight time between 0.50 s and 0.74 s and a curl of at most 6 m/s² either way. During the CPU's turn the kicker and the player's gloves shall be shown and the CPU goalkeeper hidden. | SYS-005 |

### 3.6 Player's goalkeeping

| ID | Requirement | Refines |
|---|---|---|
| SWR-016 | During the CPU's turn the gloves shall move toward the point on the goalkeeper's plane under the pointer, at no more than 9 m/s, limited to \|x\| ≤ 3.9 m and 0.2 m ≤ y ≤ 2.75 m. | SYS-004, SYS-009 |

### 3.7 Display

| ID | Requirement | Refines |
|---|---|---|
| SWR-018 | The scoreboard shall show each side's goals, updated when each result is recorded. | SYS-007 |
| SWR-019 | The scoreboard shall show one marker per kick for each side: five in regulation, marked as goal, no goal, current or pending. In sudden death it shall show only the sudden-death kicks. | SYS-007 |
| SWR-020 | A phase label shall read "Kick n of 5" or "Sudden death", followed by "Your kick" or "Their kick". | SYS-007 |
| SWR-021 | After each kick a banner shall state the result. On the player's kicks: "Goal!", "Saved", "Off the post", "Off the bar", "Wide" or "Over the bar", with the launch speed in km/h (m/s × 3.6, rounded). On the CPU's kicks: "They score", "What a save!", or the woodwork or miss description with "They miss". | SYS-007 |
| SWR-023 | On load the software shall show a start screen with the title, the rules, the control for each role and a "Kick off" button, with the HUD hidden. Pressing the button shall hide the start screen, show the HUD and start a match. | SYS-010 |
| SWR-024 | When a match is decided the software shall show "You win" or "You lose", the final score, whether it went to sudden death, and a "Play again" button that starts a new match from 0–0. | SYS-010 |
| SWR-026 | In both the shooting view and the goalkeeping view the whole goal mouth shall be visible at 1100×650, 390×844, 844×390, 1024×768 and 768×1024 viewports, and the page shall never be wider than the viewport. | SYS-009, SYS-014 |

### 3.8 iPad

| ID | Requirement | Refines |
|---|---|---|
| SWR-032 | Browser gestures shall not interrupt play on touch devices. The page shall declare a viewport that cannot be scaled; the canvas shall have `touch-action: none` and shall cancel `touchmove` and `contextmenu` events; the document shall cancel `gesturestart` events; and the page shall never be larger than the viewport in either direction. | SYS-014 |
| SWR-033 | The page shall be installable to the iPad Home Screen as a full-screen app: it shall declare `apple-mobile-web-app-capable`, a status-bar style, an app title, a 180×180 `apple-touch-icon`, and a web app manifest with the name "Twelve Yards", `display: fullscreen`, a start URL and 180×180 and 512×512 PNG icons. The HUD and start screen shall be inset by the device's safe areas. | SYS-014 |
| SWR-034 | After the app has been in the background the game shall recover: a suspended audio context shall be resumed on the player's next touch, and after a lost WebGL context is restored the scene shall be drawn again and the game shall continue. | SYS-014 |

### 3.9 Sound, failure and motion

| ID | Requirement | Refines |
|---|---|---|
| SWR-025 | The software shall create its audio output only after the player presses a button. A sound button shall toggle the master volume between 1 and 0, and shall show its state as "Sound on" or "Sound off" and through `aria-pressed`. | SYS-008 |
| SWR-027 | If three.js fails to load or a WebGL context cannot be created, the software shall show a message saying that WebGL is needed and shall hide the start screen. | SYS-011 |
| SWR-028 | When the browser reports `prefers-reduced-motion: reduce`, the software shall not apply camera shake or camera drift and shall not animate the result banner. | SYS-012 |

## 4. Traceability to system requirements

| System requirement | Software requirements |
|---|---|
| SYS-001 | SWR-001 |
| SYS-002 | SWR-003, SWR-004, SWR-005, SWR-022 |
| SYS-003 | SWR-006, SWR-007, SWR-008, SWR-009 |
| SYS-004 | SWR-014, SWR-016 |
| SYS-005 | SWR-014, SWR-015, SWR-017 |
| SYS-006 | SWR-002, SWR-010, SWR-011, SWR-012, SWR-013, SWR-014, SWR-030 |
| SYS-007 | SWR-018, SWR-019, SWR-020, SWR-021 |
| SYS-008 | SWR-025 |
| SYS-009 | SWR-006, SWR-016, SWR-026 |
| SYS-010 | SWR-023, SWR-024 |
| SYS-011 | SWR-027 |
| SYS-012 | SWR-028 |
| SYS-013 | SWR-001, SWR-029, SWR-031 |
| SYS-014 | SWR-026, SWR-032, SWR-033, SWR-034 |

## 5. Known gaps

- The CPU's choice of where to aim and where to dive is random within the stated limits; its distribution is not specified.
- No frame-rate requirement is specified. A manual verification case records the intended target of 30 frames per second.
- The visual design (stadium, figures, colours, typography) is not specified.
