# System Requirements

Product: Twelve Yards (3D penalty shootout game)

## 1. Purpose and scope

Twelve Yards is a single-player penalty shootout played in a web browser. The player takes penalties against a computer-controlled goalkeeper and keeps goal against a computer-controlled kicker.

The system is the game as the player meets it: one web page, the browser it runs in, and the player's pointing device, screen and speakers. These requirements state what that system shall do. They are refined into software requirements in [02-software-requirements.md](02-software-requirements.md).

Out of scope: multiplayer, accounts, saved progress, leaderboards, teams or player selection, difficulty settings.

## 2. Definitions

| Term | Meaning |
|---|---|
| Player | The person using the game |
| CPU | The computer-controlled opponent, acting as goalkeeper on the player's kicks and as kicker on its own |
| Kick | One penalty, from the whistle to its recorded result |
| Result | The outcome of one kick: goal, save, woodwork (post or crossbar) or miss |
| Flick | A press, drag and release on the pitch view, by mouse or finger |
| Sudden death | Kicks taken in pairs after five kicks each have left the score level |
| HUD | The scoreboard, phase label, hint and result banner drawn over the pitch |

## 3. Requirements

Each requirement has an identifier, a statement and a rationale. All are mandatory.

### 3.1 Product

| ID | Requirement | Rationale |
|---|---|---|
| SYS-001 | The system shall present a penalty shootout between the player and the CPU in a real-time 3D view, playable in a web browser without installing anything. | Core purpose. |
| SYS-013 | The system shall be delivered as one self-contained web page whose only external resources are the 3D rendering library and web fonts. It shall not store or transmit any player data. | Easy to host and share; nothing to consent to. |

### 3.2 Match rules

| ID | Requirement | Rationale |
|---|---|---|
| SYS-002 | The system shall run the shootout in the standard format: the sides kick alternately, the player first, five kicks each; the match ends early once one side cannot be caught; if level after five each, it continues in sudden death until one side leads after an equal number of kicks. | Matches the rules players know. |
| SYS-006 | The system shall simulate the ball and goal at real scale: an 11 m penalty distance and a 7.32 m × 2.44 m goal. Every kick shall end in exactly one result: goal, save, woodwork or miss. | Shots should behave believably and be scored unambiguously. |

### 3.3 Play

| ID | Requirement | Rationale |
|---|---|---|
| SYS-003 | The system shall let the player take a kick with a single flick that sets the shot's direction, height, power and curl. | One gesture that rewards skill. |
| SYS-004 | The system shall let the player defend the CPU's kicks by steering a pair of goalkeeper gloves across the goal. | Gives the player both roles. |
| SYS-005 | The system shall provide a CPU goalkeeper that reacts to the player's shots and a CPU kicker that takes its own kicks without player input. | Single-player opponent. |

### 3.4 Feedback

| ID | Requirement | Rationale |
|---|---|---|
| SYS-007 | The system shall show the running score, the result of each kick taken so far, whose kick it is and its number, and after each kick its result and the shot speed. | The player must always know the state of the match. |
| SYS-008 | The system shall give sound feedback for the whistle, the kick, crowd reactions and woodwork, and shall let the player switch sound off and on. | Atmosphere, with control over it. |
| SYS-010 | The system shall open on a start screen that explains the rules and both controls, and shall end each match on a result screen that offers another match. | Playable without outside instructions. |

### 3.5 Platforms and accessibility

| ID | Requirement | Rationale |
|---|---|---|
| SYS-009 | The system shall be playable with a mouse or a touchscreen, on desktop and phone-sized screens, in portrait and landscape. | Reach. |
| SYS-011 | Where the browser cannot provide 3D graphics, the system shall tell the player so instead of showing a blank or broken page. | Fail visibly. |
| SYS-012 | Where the player has asked their device to reduce motion, the system shall remove decorative motion: camera shake, camera drift and animated banners. | Accessibility. |

## 4. Traceability

Every system requirement is refined by at least one software requirement. The mapping is in section 4 of [02-software-requirements.md](02-software-requirements.md).
