# Lagos Traffic Survivor 3D

Pick up passengers and parcels across four Lagos routes in 3D, deliver them on time, and spend your earnings in the garage. Drive a **Salon Car**, **Okada** or **Danfo**.

```bash
npm install
npm start        # http://localhost:3000  (PORT=xxxx to change)
```

**Play online:** https://mr-chigozie.github.io/lagos-traffic-survivor/

## Hosting

- **GitHub Pages** (the game): every push to `main` runs `.github/workflows/pages.yml`, which publishes `public/` plus Three.js.
- **Render** (online races + shared leaderboard): render.com → New → Blueprint → this repo, which uses `render.yaml`. The Pages copy talks to `REMOTE_SERVER` in `public/js/config.js`; change it if Render gives the service a different URL. The free server sleeps when idle, so the first online connection can take up to a minute. Its disk is wiped on restart, which resets the leaderboard.
- Without the server, the Pages copy still plays solo and keeps your best score on the device.

## Routes

| Route | Terrain | Time | Notes |
|---|---|---|---|
| Third Mainland Bridge | Bridge over the lagoon, stilt village, skyline | Morning | Concrete barriers, no shoulder |
| Ikorodu Road | Dense city, billboards, pedestrian bridges | Hazy afternoon | 4 lanes + BRT lane (danfos ignore it) |
| Lekki–Epe Expressway | Coast, palms, walled estates, sea | Sunset | Fast and long |
| Oshodi Under-Bridge | Night market, overpasses, crowds | Night | Gridlock, hawkers, headlights |

## Controls

`W/↑` gas · `S/↓` brake · `A D / ← →` steer · `Space` horn · `C` camera · `Esc` pause · `M` mute.
On touch devices, on-screen pedals and steering appear automatically.

## Jobs

- **Green beams** are customers waiting at the roadside. Stop beside them in the right lane to load (about a second each).
- Each customer has a **coloured drop-off beam** and a timer. Stop there to deliver. Drive past it and the job is lost.
- Pay = distance-based fare, +20% on time or −30% late. Passengers tip or complain based on how many crashes they sat through; fragile parcels lose value when you crash.
- Capacity: car 3, okada 1 (best pay per metre), danfo 8 (cheap fares, lots of them).
- At the end of a shift, a **repair bill** for damage is taken from your earnings and the rest goes into your wallet.

## Wallet and garage

- The wallet persists in the browser (`localStorage`), starting at ₦5,000.
- Unlock the Okada (₦12,000), Danfo (₦35,000), Lekki–Epe (₦15,000) and Oshodi (₦25,000).
- Per-vehicle upgrades: engine, tyres, body work, extra space, loud horn, plus paint colours.

## Profile

Type your name and tap the avatar circle to add a photo. The photo is cropped to 96×96 and kept in the browser; it appears on the HUD and, when you post a score, on the leaderboard.

## Online multiplayer

Up to 6 drivers race the same route together. Everyone gets the same customers in the same places. **Highest score wins** (speed, deliveries and condition all count), and earnings still go into each player's wallet.

1. Press **PLAY ONLINE**, then **CREATE ROOM**. You get a 4-character code and an invite link.
2. Friends press **PLAY ONLINE**, type the code (or open the invite link), pick a ride and press **I'M READY**.
3. The host picks the route and presses **START RACE**.

Other players appear as cars with name tags, on the minimap and in the live standings. Bumping them shoves you but does no damage. Pause can't stop an online race, and leaving mid-race counts as a DNF.

**Who can join:** everyone must open the same server.
- *Same Wi-Fi:* `npm start` prints a LAN address such as `http://192.168.1.20:3000`. Friends open that. Windows may ask to allow Node through the firewall; allow it on private networks.
- *Over the internet:* deploy the folder to a Node host that supports WebSockets (Render, Railway, Fly.io…), or expose your PC temporarily with a tunnel such as `cloudflared tunnel --url http://localhost:3000` and share the https link.

Each player simulates their own traffic, so NPC cars differ slightly between screens. Player positions are synced about 15 times a second over a WebSocket at `/ws`.

## Vehicles

| Vehicle | Price | Top speed | Slots | Character |
|---|---|---|---|---|
| Salon Car | free | 137 km/h | 3 | Balanced all-rounder |
| Keke Napep | ₦6,000 | 90 km/h | 3 | Cheap repairs; sharp turns at speed lift a wheel and scrub speed |
| Okada | ₦12,000 | 148 km/h | 1 | Lane-splitter, best pay per metre, fragile |
| Danfo | ₦35,000 | 112 km/h | 8 | Tough, cheap fares, traffic moves when you honk |
| Molue | ₦50,000 | 90 km/h | 14 | 9.5 m yellow giant, packed stops, very hard to hurt |
| Power Bike | ₦75,000 | 187 km/h | 1 | Express parcels, fastest and most fragile |
| Lekki SUV | ₦90,000 | 155 km/h | 4 | VIP fares, traffic gives way, repairs cost a fortune |

All per-vehicle rules (stats, fares, repair cost, camera, sounds) live in the `VEHICLES` table in `public/js/maps.js`.

## Drivers

| Driver | Style |
|---|---|
| Mama Nkechi | +25% toughness, potholes hurt less, slightly slower |
| Baba Tunde | Horn much more effective, +10% toughness |
| Chidi | Close passes and coins score more, a bit fragile |
| Aisha | Better handling, speed and acceleration, more fragile |
| Emeka | Repair bills 40% cheaper, +10% toughness, slower off the line |
| Aunty Funke | Fares +15%, each passenger forgives one bump, slightly slower |

Each driver has three outfits (one free, then ₦3,000 and ₦6,000), picked from the swatches on their card. Outfits change the portrait and what the rider wears on an okada, keke or power bike, and other players see them online.

## Gameplay

- Traffic uses a car-following model (IDM) with lane changes. Danfos cut in and stop for passengers, okadas lane-split, trucks hog the slow lane.
- Honk and most drivers move over. A Danfo's horn works better.
- Hazards: potholes, roadworks lane closures, go-slow jams, crossing pedestrians and hawkers.
- Score: distance + ₦ coins + close-pass combos + time and condition bonuses at the finish. Three stars = finish under par with 60%+ condition.
- Finished runs can be posted to the leaderboard (`GET/POST /api/scores`, stored in `data/scores.json`).

## Structure

```
server.js            static server, /vendor/three from node_modules, scores API
multiplayer.js       WebSocket rooms, lobby and race relay (ws package)
public/index.html    Tailwind UI shell (menu, HUD, minimap, touch controls)
public/js/
  main.js            game loop, player physics, collisions, camera, HUD
  maps.js            route, vehicle and driver definitions
  jobs.js            pickups, drop-offs, pay
  online.js          WebSocket client + other players' cars
  portraits.js       SVG driver portraits
  career.js          wallet, unlocks, garage upgrades, paint
  track.js           road spline in road-space (s, lat) + ribbon geometry
  world.js           terrain, water, bridge, buildings, scenery, lighting
  course.js          potholes, roadworks, jams, pedestrians, coins, repairs
  traffic.js         NPC traffic AI
  models.js          low-poly vehicle/prop models
  audio.js           Web Audio synth (engine, horns, crashes)
legacy/              original 2D canvas version
```
