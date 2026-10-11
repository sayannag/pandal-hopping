/* Pujo Parikrama — decorative hero art (generated SVG, no image downloads). */
(function () {
  'use strict';
  const PP = window.PP;
  const NS = 'http://www.w3.org/2000/svg';
  const rnd = (() => { let s = 1433; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const f = (n) => Math.round(n * 10) / 10;

  function lights(svg) {
    if (!svg) return;
    const colors = ['#ffb020', '#ff4433', '#fff6e8', '#34d6c0', '#ff2e63', '#f7c95b'];
    let html = '<defs><filter id="bulbGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    const strands = [{ x0: -20, x1: 520, y: 8, sag: 46 }, { x0: 480, x1: 980, y: 4, sag: 38 }, { x0: 940, x1: 1460, y: 10, sag: 50 }];
    strands.forEach((st, si) => {
      const mx = (st.x0 + st.x1) / 2, cy = st.y + st.sag * 2;
      html += `<path d="M${st.x0} ${st.y} Q${mx} ${cy} ${st.x1} ${st.y}" fill="none" stroke="rgba(255,220,170,.28)" stroke-width="1.4"/>`;
      const n = 22;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = (1 - t) * (1 - t) * st.x0 + 2 * (1 - t) * t * mx + t * t * st.x1;
        const y = (1 - t) * (1 - t) * st.y + 2 * (1 - t) * t * cy + t * t * st.y;
        const c = colors[(i + si * 2) % colors.length];
        html += `<circle class="bulb" cx="${f(x)}" cy="${f(y + 5)}" r="3.6" fill="${c}" filter="url(#bulbGlow)" style="animation-delay:${f(rnd() * 2.8)}s"/>`;
      }
    });
    svg.innerHTML = html;
  }

  function eye(cx, cy, w, h, rot) {
    const g = `<g transform="rotate(${rot || 0} ${cx} ${cy})">`;
    const almond = `M${cx - w} ${cy} C${cx - w * 0.5} ${cy - h} ${cx + w * 0.45} ${cy - h * 1.05} ${cx + w} ${cy} C${cx + w * 0.45} ${cy + h * 0.85} ${cx - w * 0.5} ${cy + h * 0.8} ${cx - w} ${cy} Z`;
    const flick = `M${cx + w * 0.92} ${cy - h * 0.08} Q${cx + w * 1.32} ${cy - h * 0.38} ${cx + w * 1.55} ${cy - h * 0.95}`;
    const flick2 = `M${cx - w * 0.95} ${cy + h * 0.05} Q${cx - w * 1.18} ${cy + h * 0.02} ${cx - w * 1.3} ${cy - h * 0.15}`;
    return g +
      `<path d="${almond}" fill="#fff6e8" fill-opacity=".96" stroke="#1a0a0f" stroke-width="5"/>` +
      `<circle cx="${cx + w * 0.08}" cy="${cy}" r="${h * 0.66}" fill="url(#iris)"/>` +
      `<circle cx="${cx + w * 0.08}" cy="${cy}" r="${h * 0.3}" fill="#12070a"/>` +
      `<circle cx="${cx + w * 0.18}" cy="${cy - h * 0.2}" r="${h * 0.12}" fill="#fff"/>` +
      `<path d="${flick}" fill="none" stroke="#1a0a0f" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="${flick2}" fill="none" stroke="#1a0a0f" stroke-width="4" stroke-linecap="round"/>` +
      '</g>';
  }

  function arch(svg) {
    if (!svg) return;
    const cx = 300, cy = 330;
    let h = `<defs>
      <linearGradient id="fireG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ff3b30"/></linearGradient>
      <radialGradient id="innerG" cx=".5" cy=".95" r=".9"><stop offset="0" stop-color="#ff6a3d" stop-opacity=".75"/><stop offset=".45" stop-color="#b3122a" stop-opacity=".55"/><stop offset="1" stop-color="#3a0c16" stop-opacity="0"/></radialGradient>
      <radialGradient id="iris" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ff9a3d"/><stop offset=".55" stop-color="#c81d25"/><stop offset="1" stop-color="#5a0a12"/></radialGradient>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="topHalf"><rect x="0" y="0" width="600" height="${cy}"/></clipPath>
    </defs>`;
    h += `<path d="M${cx - 168} ${cy} A168 168 0 0 1 ${cx + 168} ${cy} Z" fill="url(#innerG)"/>`;
    h += `<path d="M${cx - 240} ${cy} A240 240 0 0 1 ${cx + 240} ${cy}" fill="none" stroke="url(#fireG)" stroke-width="16" stroke-linecap="round" filter="url(#softGlow)"/>`;
    // outer beads (chalchitra scallops)
    let beads = '';
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI + (i / 40) * Math.PI;
      const x = cx + 268 * Math.cos(a), y = cy + 268 * Math.sin(a);
      beads += `<circle cx="${f(x)}" cy="${f(y)}" r="${i % 2 ? 5.5 : 8}" fill="${i % 2 ? '#ff4433' : '#ffb020'}" opacity="${i % 2 ? 0.85 : 1}"/>`;
    }
    h += beads;
    // rotating dotted ring
    h += `<g clip-path="url(#topHalf)"><g class="spin"><circle cx="${cx}" cy="${cy}" r="214" fill="none" stroke="#f7c95b" stroke-width="3" stroke-dasharray="2 13" stroke-linecap="round" opacity=".9"/></g></g>`;
    // petal ring
    let petals = '';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * 360;
      petals += `<ellipse cx="${cx}" cy="${cy - 188}" rx="7" ry="18" fill="${i % 2 ? '#ff7a1a' : '#ffd27a'}" opacity=".75" transform="rotate(${a} ${cx} ${cy})"/>`;
    }
    h += `<g clip-path="url(#topHalf)"><g class="spin-rev">${petals}</g></g>`;
    h += `<path d="M${cx - 150} ${cy} A150 150 0 0 1 ${cx + 150} ${cy}" fill="none" stroke="#fff6e8" stroke-opacity=".35" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>`;
    // eyes
    h += `<g class="eye-glow" filter="url(#softGlow)">`;
    h += `<path d="M${cx - 112} ${cy - 104} Q${cx - 60} ${cy - 132} ${cx - 16} ${cy - 108}" fill="none" stroke="#1a0a0f" stroke-width="7" stroke-linecap="round" opacity=".85"/>`;
    h += `<path d="M${cx + 112} ${cy - 104} Q${cx + 60} ${cy - 132} ${cx + 16} ${cy - 108}" fill="none" stroke="#1a0a0f" stroke-width="7" stroke-linecap="round" opacity=".85"/>`;
    h += eye(cx - 62, cy - 62, 46, 26, 0);
    h += `<g transform="translate(${2 * cx} 0) scale(-1 1)">${eye(cx - 62, cy - 62, 46, 26, 0)}</g>`;
    h += eye(cx, cy - 140, 23, 13, -90);
    h += `<circle cx="${cx}" cy="${cy - 104}" r="7" fill="#ff3b30"/>`;
    h += '</g>';
    // plinth
    h += `<path d="M${cx - 290} ${cy + 2} H${cx + 290}" stroke="url(#fireG)" stroke-width="9" stroke-linecap="round"/>`;
    for (let i = 0; i < 25; i++) h += `<circle cx="${cx - 276 + i * 23}" cy="${cy + 18}" r="2.4" fill="#f7c95b" opacity=".7"/>`;
    svg.innerHTML = h;
  }

  function kaash(svg) {
    if (!svg) return;
    let h = '<defs><filter id="kaashBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>';
    for (let i = 0; i < 70; i++) {
      const x0 = i * 21 + rnd() * 14 - 7, y0 = 124;
      const tx = x0 + (rnd() - 0.35) * 38, ty = 22 + rnd() * 50;
      const cx = x0 + (tx - x0) * 0.2, cy = (y0 + ty) / 2;
      const P = (t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * tx, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * ty];
      const D = (t) => { const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (tx - cx), dy = 2 * (1 - t) * (cy - y0) + 2 * t * (ty - cy); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      let hairs = '';
      for (let k = 0; k < 16; k++) {
        const t = 0.6 + k * 0.025;
        const [px, py] = P(t), [dx, dy] = D(t);
        const side = k % 2 ? 1 : -1, ang = (0.32 + rnd() * 0.3) * side;
        const len = 6 + 9 * Math.sin(Math.PI * (k / 15)) + rnd() * 3;
        const hx = dx * Math.cos(ang) - dy * Math.sin(ang), hy = dx * Math.sin(ang) + dy * Math.cos(ang);
        hairs += `M${f(px)} ${f(py)} l${f(hx * len)} ${f(hy * len)} `;
      }
      const [mx, my] = P(0.8), [ddx, ddy] = D(0.8);
      const rot = f((Math.atan2(ddy, ddx) * 180) / Math.PI + 90);
      h += `<g class="stalk" style="animation-delay:${f(-rnd() * 6)}s;animation-duration:${f(5 + rnd() * 3)}s">` +
        `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="6" ry="17" transform="rotate(${rot} ${f(mx)} ${f(my)})" fill="#fff6e8" opacity=".16" filter="url(#kaashBlur)"/>` +
        `<path d="M${f(x0)} ${y0} Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}" fill="none" stroke="#d9c7a8" stroke-opacity=".45" stroke-width="1.3"/>` +
        `<path d="${hairs}" fill="none" stroke="#fff6e8" stroke-opacity=".6" stroke-width=".9" stroke-linecap="round"/>` +
        '</g>';
    }
    svg.innerHTML = h;
  }

  PP.art = { draw() { lights(document.getElementById('lights')); arch(document.getElementById('arch')); kaash(document.getElementById('kaash')); } };
})();
