# Annapurna Eco Lodge Resort — digital menu

A two-page, display-only menu built for phone screens. No images, no ordering, no backend. Plain HTML, CSS and JavaScript reading one JSON file.

```
annapurna-menu/
├── index.html          Menu — hero, search, filters, featured, sections
├── about.html          About the lodge
├── css/styles.css      All styling. Design tokens are the first 25 lines.
├── js/app.js           Menu page logic
├── js/about.js         About page logic
├── data/menu.json      Everything the guest reads. The only file staff edit.
├── assets/logo.svg     Navbar mark — replace with your real logo
└── README.md
```

## Running it

The pages read `data/menu.json` with `fetch()`, which browsers block on `file://`. So opening `index.html` by double-clicking shows an empty page. Use any of these instead:

- **VS Code** — install the Live Server extension, right-click `index.html`, Open with Live Server
- **Node** — `npx serve .` inside the folder
- **Deploy it** — drag the folder onto [netlify.com/drop](https://app.netlify.com/drop). Free, no account, gives you a public URL in about 30 seconds. Point a QR code on each table at it.

## Editing the menu

Everything lives in `data/menu.json`. Nobody has to open the HTML to change a price.

### An item

```json
{
  "id": 20,
  "name": "Nepali dal bhat set, white rice",
  "description": "White rice, dal, vegetable curry, pickle, papad and salad.",
  "price": 495,
  "category": "mains",
  "tags": ["popular", "vegetarian"],
  "featured": true
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Any unique number |
| `name` | yes | |
| `price` | yes | Number only. "Rs" comes from `restaurant.currency`. |
| `category` | yes | Must match a `categories` id |
| `description` | no | Use `""` to leave the line out |
| `tags` | no | `vegetarian`, `vegan`, `spicy`, `popular` |
| `featured` | no | `true` puts it in the "What we are known for" strip |

Only those four tags are recognised. `vegetarian`, `vegan` and `spicy` also drive the filter sheet — add a new tag word and it shows as a pill but won't be filterable until you add it to the `DIETS` object at the top of `js/app.js`.

To take an item off the menu, delete its block. To reorder sections, reorder the `categories` array — chips and page sections both follow it.

## What I changed from your file

- **Removed** every `image` field and the `calories` fields, which were all zero
- **Renamed two sections** for clarity, since "Drinks" and "Beverages" were hard to tell apart: `drinks` now reads **Tea & Coffee**, `beverages` reads **Cold Drinks & Bar**. `specials` reads **Today's Specials**. The ids are unchanged, only the labels.
- **Name**: your file said "Annapurna Eco-Village Resort", you told me "Annapurna Eco Lodge Resort". I used the latter. It appears in `data/menu.json`, both `<title>` tags and the `.nav__name` span in each HTML file.
- **Spelling tidied** on a few items: thupka → thukpa, sadako → sadeko, Bhata → Bhatmas, lalipop → lollipop, Saksuka → Shakshuka, omelet → omelette. Change any of these back if the printed menu uses different spellings.
- **Added** `featured` to six dishes, a `note` line per section, and an `about` block.

## Placeholder copy — please read

I wrote the About page text and the section notes from general knowledge of Astam. **Check them before going live.** Specifically:

- The three story paragraphs in `about.about.paragraphs`
- The four cards in `about.about.highlights`
- `restaurant.hours` currently says "Kitchen open daily" — your file said "Mon–Sun", so set real serving times
- Every `note` under `categories`

Nothing there states a founding date, room count or award, so nothing should be factually wrong, but it is my wording, not yours.

## Changing the look

The palette is dark forest green, pale mist and marigold — taken from the range at dawn. All of it is CSS variables at the top of `css/styles.css`:

```css
--forest: #16291F;   /* navbar, hero, buttons */
--mist:   #E9EDE4;   /* page background */
--marigold: #B8790C; /* prices, accents */
```

Change those three and the whole site follows. Fonts are Newsreader (headings, dish names) and Figtree (everything else), swapped in the `--serif` / `--sans` variables plus the Google Fonts `<link>` in both HTML files.

The mountain ridgeline under the hero is inline SVG in each HTML file — search for `hero__ridge`.

## Replacing the logo

Overwrite `assets/logo.svg` with your own. It is used in the navbar, the browser tab icon, and nothing else. Keep it roughly square; it renders at 34×34.

---

## The order pad

Guests can build an order on their phone and hold it up for a server. **Nothing is sent anywhere** — there is no backend, no kitchen printer, no notification. The server reads the screen and writes it down.

**How it flows**

1. Every dish has a `+` button. Tapping it turns into a `−  1  +` stepper.
2. A bar appears at the bottom of the screen: item count, running total, "Review order".
3. The basket screen lists each line with quantity controls, a per-item note, Remove, an optional table or room number, and the total.
4. "Show to server" opens a full-screen summary sized to be read at arm's length: white background, large quantities in amber, dishes grouped by section, notes in highlighted boxes, total and timestamp at the bottom. The only tappable thing on it is the Done button, so it cannot be scrolled away or altered by accident while someone else is holding the phone.

**Details worth knowing**

- **Services are not orderable.** Laundry, yoga, reiki and the hot water bucket have no `+` button, because the section note says to arrange them at reception. This is controlled by `"orderable": false` on the services category in `data/menu.json` — remove that line to make them orderable, or add it to any other section to lock it.
- **The order survives a refresh.** It is saved in the browser's local storage, wrapped in a try/catch so that a browser with storage disabled just keeps it in memory for the session instead. It is per-device, never leaves the phone, and is never seen by you.
- **Clear** wipes the order and the table number, with a confirmation prompt. Worth showing staff, so a table starts clean for the next guests.
- **The screen is kept awake** while the server summary is open, where the browser supports it, so it does not dim mid-read.
- Quantities max out at 99 per dish and notes at 120 characters.

Nothing about the order flow needs configuration. If you ever want to remove it entirely, delete the `orderbar`, `basketScreen` and `waiterScreen` blocks from `index.html` — the menu keeps working.
