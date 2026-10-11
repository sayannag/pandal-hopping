#!/usr/bin/env python3
"""Rebuild the Kolkata Metro network (stations + simplified line geometry) from OpenStreetMap.

Writes tools/.cache/metro_built.json, which tools/build_data.py turns into data/metro.js together
with tools/sources/metro_schedule.json. Run via: python3 tools/build_data.py --refresh-metro
Data © OpenStreetMap contributors (ODbL).
"""
import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, hav, overpass, save  # noqa: E402

COLORS = {'blue': ('Blue Line', '#2f6bff'), 'green': ('Green Line', '#1fb35b'), 'purple': ('Purple Line', '#a24bdc'),
          'orange': ('Orange Line', '#ff7a1a'), 'yellow': ('Yellow Line', '#f4c20d')}
CANON = {'Esplanade (Line 1)': 'Esplanade', 'Esplanade (Line 2)': 'Esplanade', 'Noapara (Blue Line)': 'Noapara',
         'Noapara (Yellow Line)': 'Noapara', 'Kavi Subhash (Blue Line)': 'Kavi Subhash', 'Kavi Subhash (Orange Line)': 'Kavi Subhash',
         'Dakshineshwar': 'Dakshineswar'}
CLOSED = {('blue', 'Kavi Subhash')}  # Blue Line platform closed since 2024; trains terminate at Shahid Khudiram


def merge_ways(ways):
    segs = [[(p['lat'], p['lon']) for p in w['geometry']] for w in ways if 'geometry' in w]
    if not segs:
        return []
    line = segs.pop(0)
    while segs:
        best = None
        for i, s in enumerate(segs):
            for rl in (False, True):
                L = line[::-1] if rl else line
                for rs in (False, True):
                    S = s[::-1] if rs else s
                    d = hav(L[-1], S[0])
                    if best is None or d < best[0]:
                        best = (d, i, rl, rs)
        d, i, rl, rs = best
        s = segs.pop(i)
        line = line[::-1] if rl else line
        s = s[::-1] if rs else s
        line = line + s[1:] if d < 0.01 else line + s
    return line


def simplify(pts, tol=0.012):
    if len(pts) < 3:
        return pts

    def perp(p, a, b):
        kx, ky = 111.32 * math.cos(math.radians(a[0])), 110.57
        ax, ay, bx, by, px, py = a[1] * kx, a[0] * ky, b[1] * kx, b[0] * ky, p[1] * kx, p[0] * ky
        dx, dy = bx - ax, by - ay
        if dx == dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = perp(pts[i], pts[0], pts[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [pts[0], pts[-1]]


def main():
    rels = overpass('[out:json][timeout:180];relation["route"="subway"](22.35,88.15,22.80,88.55);out geom;')['elements']
    chosen = {}
    for r in rels:
        key = next((k for k in COLORS if k in (r['tags'].get('name', '') + ' ' + r['tags'].get('ref', '')).lower()), None)
        if key and key not in chosen:
            chosen[key] = r
    stop_ids = [m['ref'] for r in chosen.values() for m in r['members'] if m['type'] == 'node' and m['role'].startswith('stop')]
    nodes = {e['id']: e for e in overpass(f'[out:json][timeout:120];node(id:{",".join(map(str, stop_ids))});out body;')['elements']}
    stations, lines = {}, []
    for key, r in chosen.items():
        stops = []
        for m in r['members']:
            if m['type'] != 'node' or not m['role'].startswith('stop'):
                continue
            n = nodes[m['ref']]
            t = n.get('tags', {})
            name = CANON.get(t.get('name'), t.get('name'))
            sid = name.lower().replace(' ', '-').replace('.', '')
            st = stations.setdefault(sid, {'id': sid, 'name': name, 'bn': t.get('name:bn', ''), 'lat': round(n['lat'], 5), 'lon': round(n['lon'], 5), 'lines': []})
            if (key, name) in CLOSED:
                continue
            if key not in st['lines']:
                st['lines'].append(key)
            stops.append(sid)
        geom = simplify(merge_ways([m for m in r['members'] if m['type'] == 'way' and m['role'] == '']))
        lines.append({'id': key, 'name': COLORS[key][0], 'color': COLORS[key][1], 'stations': stops, 'path': [[round(a, 5), round(b, 5)] for a, b in geom]})
        print(f'{COLORS[key][0]}: {len(stops)} stations')
    save(os.path.join(CACHE, 'metro_built.json'), {'stations': list(stations.values()), 'lines': lines})


if __name__ == '__main__':
    main()
