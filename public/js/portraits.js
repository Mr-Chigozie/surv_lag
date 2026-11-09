// Hand-drawn SVG portraits for the selectable drivers. No image files: each portrait is
// built from simple shapes so it stays crisp at any size and weighs a few KB.

let uid = 0;

const SHOULDERS = "M8 100 C10 80 30 72 50 72 C70 72 90 80 92 100 Z";

function eyes(lashes = false, y = 47) {
  const one = (x) => `
    <ellipse cx="${x}" cy="${y}" rx="3.2" ry="2.3" fill="#fbf6ee"/>
    <circle cx="${x + 0.3}" cy="${y + 0.1}" r="1.7" fill="#2a1a10"/>
    <circle cx="${x + 0.9}" cy="${y - 0.6}" r="0.55" fill="#fff"/>
    ${lashes ? `<path d="M${x - 3.6} ${y - 0.6} Q${x} ${y - 3.8} ${x + 3.8} ${y - 1.2}" stroke="#1a0e08" stroke-width="1.1" fill="none" stroke-linecap="round"/>` : ""}`;
  return one(43) + one(57);
}

function nose(shade) {
  return `<path d="M50.5 47 Q49 52 48.5 54" stroke="${shade}" stroke-width="0.9" fill="none" stroke-linecap="round"/>
    <path d="M46.5 55 Q50 57.8 53.5 55" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
}

function head(skin, shade, { ears = true, neck = true, rx = 16, ry = 19 } = {}) {
  return `
    ${neck ? `<rect x="44" y="58" width="12" height="17" rx="4" fill="${shade}"/>` : ""}
    ${ears ? `<ellipse cx="${50 - rx}" cy="49" rx="3" ry="4.5" fill="${shade}"/><ellipse cx="${50 + rx}" cy="49" rx="3" ry="4.5" fill="${shade}"/>` : ""}
    <ellipse cx="50" cy="47" rx="${rx}" ry="${ry}" fill="${skin}"/>
    <ellipse cx="50" cy="61" rx="${rx * 0.62}" ry="4" fill="${shade}" opacity="0.25"/>`;
}

const DRAW = {
  // Mama Nkechi: orange gele, ankara blouse, gold earrings, warm smile.
  nkechi(id) {
    const skin = "#6e3f26", shade = "#552f1b";
    return `
      <defs>
        <pattern id="${id}a" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#17607a"/>
          <circle cx="4.5" cy="4.5" r="2.6" fill="#f2b705"/><circle cx="4.5" cy="4.5" r="1.1" fill="#e5632f"/>
          <circle cx="0" cy="0" r="1.2" fill="#fbf6ee"/><circle cx="9" cy="9" r="1.2" fill="#fbf6ee"/>
        </pattern>
      </defs>
      <path d="${SHOULDERS}" fill="url(#${id}a)"/>
      <path d="M38 73 Q50 84 62 73" stroke="#f2b705" stroke-width="2" fill="none"/>
      ${head(skin, shade, { rx: 17 })}
      <path d="M38.5 42.5 Q43 40 47 42" stroke="#1a0e08" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M53 42 Q57 40 61.5 42.5" stroke="#1a0e08" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      ${eyes(true)}${nose(shade)}
      <ellipse cx="40" cy="55" rx="3.2" ry="2" fill="#c0563a" opacity="0.3"/><ellipse cx="60" cy="55" rx="3.2" ry="2" fill="#c0563a" opacity="0.3"/>
      <path d="M43 59.5 Q50 66.5 57 59.5 Q50 62 43 59.5Z" fill="#7a2a1e"/>
      <path d="M44.5 60.3 Q50 62.4 55.5 60.3 L55 61.3 Q50 63 45 61.3Z" fill="#fff"/>
      <path d="M30 41 C22 28 20 15 31 9 C39 4 45 12 50 7 C56 1 67 4 72 10 C82 18 80 30 70 41 C62 33 38 33 30 41Z" fill="#f08a24"/>
      <path d="M66 15 C76 4 92 10 88 24 C82 19 75 20 69 24Z" fill="#e5632f"/>
      <path d="M34 12 C24 8 12 16 16 28 C21 22 27 21 32 24Z" fill="#e5632f"/>
      <path d="M33 34 C40 28 60 28 67 34 M31 26 C40 18 58 18 70 24 M37 15 C44 10 56 10 64 14" stroke="#b85a14" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M30 41 C38 35 62 35 70 41" stroke="#ffb45a" stroke-width="2" fill="none"/>
      <circle cx="33" cy="56" r="2.6" fill="none" stroke="#f2c230" stroke-width="1.4"/>
      <circle cx="67" cy="56" r="2.6" fill="none" stroke="#f2c230" stroke-width="1.4"/>`;
  },

  // Baba Tunde: tilted fila cap, grey beard, embroidered agbada.
  tunde(id) {
    const skin = "#5c3521", shade = "#472816";
    return `
      <path d="${SHOULDERS}" fill="#efe6d2"/>
      <path d="M36 74 L50 92 L64 74" stroke="#1f4f7a" stroke-width="3" fill="none"/>
      <path d="M40 76 L50 88 L60 76" stroke="#f2b705" stroke-width="1.2" fill="none" stroke-dasharray="2 1.5"/>
      ${head(skin, shade)}
      <path d="M38 37.5 Q44 36.5 48 38 M52 38 Q56 36.5 62 37.5" stroke="#4a3426" stroke-width="0.8" fill="none"/>
      <path d="M38 43 Q43 40.5 47.5 42.5" stroke="#cfc8be" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M52.5 42.5 Q57 40.5 62 43" stroke="#cfc8be" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      ${eyes()}
      <path d="M39 50 Q42 52 46 50.5 M54 50.5 Q58 52 61 50" stroke="${shade}" stroke-width="0.8" fill="none"/>
      ${nose(shade)}
      <path d="M33.5 49 C34 66 42 72.5 50 72.5 C58 72.5 66 66 66.5 49 C64 57 60 60.5 50 60.5 C40 60.5 36 57 33.5 49Z" fill="#d9d3ca"/>
      <path d="M42 59 Q46 56 50 57.5 Q54 56 58 59 Q54 61 50 59.8 Q46 61 42 59Z" fill="#e8e3dc"/>
      <path d="M46 63 Q50 64.5 54 63" stroke="#7a2a1e" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M33 37 C32 22 43 17 54 17 C66 17 72 25 69 36 C60 32.5 43 32.5 33 37Z" fill="#1f4f7a"/>
      <path d="M58 19 C70 11 82 15 80 25 C75 25 70 27 66 31Z" fill="#163c5e"/>
      <path d="M35 33 C45 29.5 58 29.5 68 32" stroke="#f2b705" stroke-width="1" fill="none" stroke-dasharray="1.5 1.5"/>`;
  },

  // Chidi: high-top fade, shades, gold chain, yellow jersey, big grin.
  chidi(id) {
    const skin = "#7d4b2c", shade = "#623820";
    return `
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4b5c"/><stop offset="0.5" stop-color="#0d1218"/><stop offset="1" stop-color="#22303d"/></linearGradient>
      </defs>
      <path d="${SHOULDERS}" fill="#f2b705"/>
      <path d="M22 84 L30 100 M78 84 L70 100" stroke="#2e7d4a" stroke-width="4"/>
      <path d="M40 73 Q50 80 60 73 L58 72 Q50 77 42 72Z" fill="#2e7d4a"/>
      ${head(skin, shade, { ry: 18.5 })}
      <path d="M34 40 C33 22 39 17 50 17 C61 17 67 22 66 40 C64 35 61 33 50 33 C39 33 36 35 34 40Z" fill="#17100b"/>
      <path d="M34 40 C34.5 35 37 33.5 40 33 M66 40 C65.5 35 63 33.5 60 33" stroke="#3a2a20" stroke-width="2.4" fill="none"/>
      <path d="M57 22 L62 27" stroke="#3a2a20" stroke-width="0.8"/>
      <rect x="37" y="43" width="11.5" height="7.5" rx="3" fill="url(#${id}g)" stroke="#111" stroke-width="1"/>
      <rect x="51.5" y="43" width="11.5" height="7.5" rx="3" fill="url(#${id}g)" stroke="#111" stroke-width="1"/>
      <path d="M48.5 45 Q50 44 51.5 45 M37 45 L33.5 46 M63 45 L66.5 46" stroke="#111" stroke-width="1.1" fill="none"/>
      <path d="M39 45 L42 44" stroke="#9ecbe8" stroke-width="0.9" opacity="0.8"/><path d="M53.5 45 L56.5 44" stroke="#9ecbe8" stroke-width="0.9" opacity="0.8"/>
      ${nose(shade)}
      <path d="M41.5 59 Q50 69 59.5 58 Q50 61.5 41.5 59Z" fill="#fff" stroke="#3a1a10" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M48 60.8 L48 64 M52 60.6 L52 64" stroke="#d8d0c4" stroke-width="0.6"/>
      <circle cx="66.2" cy="52" r="1" fill="#f2c230"/>
      <path d="M38 76 Q50 90 62 76" stroke="#f2c230" stroke-width="1.8" fill="none" stroke-dasharray="2.2 0.8"/>`;
  },

  // Aisha: hijab, rally goggles, racing jacket, confident smirk.
  aisha(id) {
    const skin = "#8e5735", shade = "#6f4126";
    return `
      <path d="${SHOULDERS}" fill="#c72f2f"/>
      <path d="M16 86 C24 79 30 77 34 77 M84 86 C76 79 70 77 66 77" stroke="#fbf6ee" stroke-width="3.5" fill="none"/>
      <rect x="67" y="86" width="12" height="7" rx="1.5" fill="#fbf6ee" transform="rotate(-8 73 89)"/>
      <path d="M69.5 90.5 L76.5 89.5" stroke="#c72f2f" stroke-width="1.2" transform="rotate(-8 73 89)"/>
      <path d="M50 21 C31 21 27 37 28.5 52 C30 68 37 78 50 80 C63 78 70 68 71.5 52 C73 37 69 21 50 21Z" fill="#4b2462"/>
      <path d="M30 100 C30 84 38 77 50 79 C62 77 70 84 70 100Z" fill="#4b2462"/>
      ${head(skin, shade, { ears: false, neck: false, rx: 15, ry: 18 })}
      <path d="M39.5 42.5 Q43.5 40.5 47.5 42 M52.5 42 Q56.5 40.5 60.5 42" stroke="#1a0e08" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      ${eyes(true)}${nose(shade)}
      <path d="M44 60.5 Q50 62.5 57 59" stroke="#6e2420" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M56.5 58.4 Q58 58.6 58.4 57.2" stroke="${shade}" stroke-width="0.8" fill="none" stroke-linecap="round"/>
      <path d="M28.5 52 C27.5 34 35 21 50 21 C65 21 72.5 34 71.5 52 L66 52 C66.5 40 60 33.5 50 33.5 C40 33.5 33.5 40 34 52Z" fill="#5d2d79"/>
      <path d="M34 52 C33.5 40 40 33.5 50 33.5 C60 33.5 66.5 40 66 52" stroke="#a04ec2" stroke-width="1.4" fill="none"/>
      <path d="M30 31 Q50 23 70 31" stroke="#1b1b1b" stroke-width="3.2" fill="none"/>
      <circle cx="41.5" cy="27.5" r="5.2" fill="#ff9f1c" stroke="#1b1b1b" stroke-width="1.8"/>
      <circle cx="58.5" cy="27.5" r="5.2" fill="#ff9f1c" stroke="#1b1b1b" stroke-width="1.8"/>
      <path d="M39 25.5 Q41 24 43 25 M56 25.5 Q58 24 60 25" stroke="#ffe2b0" stroke-width="1" fill="none"/>
      <circle cx="59" cy="76" r="1.6" fill="#f2c230"/>`;
  }
};

/** SVG markup for a driver's portrait, clipped to a circle on the driver's colour. */
export function driverPortrait(driver, className = "") {
  const draw = DRAW[driver.id];
  const id = `dp${++uid}`;
  return `<svg class="${className}" viewBox="0 0 100 100" role="img" aria-label="${driver.name}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${id}c"><circle cx="50" cy="50" r="50"/></clipPath>
      <radialGradient id="${id}b" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="${driver.color}" stop-opacity="0.95"/><stop offset="1" stop-color="#0b0d12"/></radialGradient>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect width="100" height="100" fill="url(#${id}b)"/>
      ${draw ? draw(id) : `<text x="50" y="60" text-anchor="middle" font-size="30" font-weight="700" fill="#fff">${driver.initials}</text>`}
    </g>
  </svg>`;
}
