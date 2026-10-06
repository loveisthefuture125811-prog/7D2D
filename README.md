# 7DTD Storage Organizer (V3.2)

A phone-first, static web app for organizing physical 7 Days to Die storage boxes.
Search any item, see which box it belongs in, tap to open the box. No backend, no npm, no build step, no external libraries.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files to the **repository root**: `index.html`, `style.css`, `app.js`, `data.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `README.md`.
3. Commit to `main`.
4. Open **Settings**.
5. Open **Pages**.
6. Under *Build and deployment*, choose **Deploy from a branch**.
7. Select branch **main**.
8. Select folder **/(root)**.
9. Click **Save**.
10. After a minute, open the Pages URL (`https://<user>.github.io/<repo>/`) in **Android Chrome**.
11. Chrome menu (⋮) → **Add to Home screen** / **Install app**.

After the first load the app shell is cached and works offline. If you update `data.js`, bump `CACHE` in `sw.js` (e.g. `7dtd-storage-v2`) so phones pick up the new data.

## Using it

- **Home:** search box on top, grid of boxes below (name + item count).
- **Search:** case-insensitive, partial, ignores punctuation (`44 magnum` finds `.44 Magnum`). Ranking: exact, starts-with, contains, then alphabetical. Tap a result to open its box (the item is highlighted).
- **Box view:** Back and Home buttons, box-only search, full item list.

## Database

- **Source:** https://www.7dtd.tools/items, "All items (937)", game version V3.2 (retrieved 2026-10-06).
- **Names are exact source names**, including odd ones like `Shotgun Shell (Ammo)`, `Exploding Crossbow Bolts` and `Box of HP 9mm Ammo (100)`.
- **Accounting:**

| | Count |
|---|---|
| Source entries reviewed | 937 |
| Excluded (non-inventory) | 69 |
| Exact duplicate source names collapsed | 6 |
| Included from /items | 862 |
| Supplemental, from /mods and /blocks | 187 |
| **Total inventory items** | **1,049** |

  937 − 69 − 6 = 862, plus 187 supplemental = 1,049. `app.js` re-checks this arithmetic on every load (`validation.supplementalItems` in `data.js`).
- **Excluded (69):** 67 `Dev:` debug/cheat entries (quality armor bundles, buff injectors, XP/quest tickets, test tools), `Health Bar` (UI object), `Missing Item` (placeholder). Full names are listed in `data.js` under `excluded`.
- **Duplicate source names (6):** `Lumberjack Hat`, `Pipe Machine Gun Bundle`, `Pipe Pistol Bundle`, `Pipe Rifle Bundle`, `Pipe Shotgun Bundle`, `Water Filter` each appear twice in the source and are stored once.
- **One home per item.** No item appears in two boxes.

### Differences from the starting structure

- Added **Workstations** (Anvil, Crucible, Cooking Pot, ...) so they don't land in Miscellaneous.
- **Armor Mods**, **Vehicle Mods**, **Dyes** and **Doors, Ladders & Storage Blocks** boxes added; **Weapon Mods** renamed **Weapon & Tool Mods**. The /items page doesn't list mods or blocks, so these come from https://www.7dtd.tools/mods (all 104 real mods, exact names; the 2 `Dev:` mods skipped) and https://www.7dtd.tools/blocks.
- **Blocks are curated, not complete.** /blocks has 5,029 entries, mostly world/POI decor, colour variants, signs, vehicles and ruins. Only player-placeable ones are in: electrical, traps/turrets/mines, workstations, doors/hatches/ladders, storage crates, beds, land claim, basic building blocks. Say if you want the rest.
- Miscellaneous holds only `Poop` and `Snowball`.
- Several old-list items don't exist in V3.2 and were not invented: `Stone Pickaxe` and a bare `Hoarder` booster (only the Hoarder armor-style clothing set exists).
- Items the old list missed that are now present: Rocket Launcher + bundles/parts, Auto Turret Bundle, Food Bundles, Ammo Crafting Bundle, the Legendary Steel crafting bundles, Explosive/Handgun Magazine, Sharp Sticks (a skill book), all stack items, and all the special clothing sets.

### Validation

On every load `app.js` checks duplicate box IDs, duplicate item names, empty or malformed boxes, invalid item values, orphaned or duplicate index entries, and the 937 / excluded / duplicates / included arithmetic. Results go to the browser console; a red banner appears only if something is wrong.

## Editing

`data.js` is the single source of truth. The search index is built from it automatically. To move an item, move its string to another box's `items` array.
