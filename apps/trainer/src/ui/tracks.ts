import type { Drill, Track, TrackRef } from '@midi-trainer/engine';
import { trackById } from '../content';
import { el, escapeHtml } from './dom';
import { toast } from './toast';

export interface ResolvedTrack {
  ref: TrackRef;
  track: Track;
}

/** A drill's suggested tracks with the pool entries resolved; unknown ids are dropped. */
export function resolveTracks(d: Drill): ResolvedTrack[] {
  return (d.tracks ?? []).flatMap((ref) => {
    const track = trackById(ref.track);
    return track ? [{ ref, track }] : [];
  });
}

export function trackLine(r: ResolvedTrack): string {
  const t = r.track;
  return `${t.artist} – ${t.title}${t.mix ? ` (${t.mix})` : ''} · ${t.bpm} BPM · ${t.key ?? 'no key'}${r.ref.deck ? ` · deck ${r.ref.deck}` : ''}`;
}

/** Plain-text tracklist for the clipboard: one record per line, then the cue notes. */
export function tracklistText(d: Drill, rows: ResolvedTrack[]): string {
  const lines = [`${d.name} — suggested tracks`, ''];
  for (const r of rows) lines.push(trackLine(r), `  ${r.ref.cue}`);
  return lines.join('\n');
}

/**
 * The "Suggested tracks" panel section: one row per record with a deck chip in the lane
 * colour, the record, BPM and key, the cue, a source link and a "Use tempo" button.
 */
export function renderTracks(d: Drill, opts: { onTempo?: (bpm: number) => void } = {}): HTMLElement {
  const host = el('div', { class: 'tracks' });
  const rows = resolveTracks(d);
  if (!rows.length) return host;
  const head = el('div', { class: 'trackshead' });
  head.appendChild(el('h3', {}, 'Suggested tracks'));
  head.appendChild(el('span', { class: 'hint' }, 'Load these in rekordbox. Cues are phrase positions in the extended mix.'));
  const copy = el('button', { class: 'small ghost', type: 'button' }, 'Copy tracklist');
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(tracklistText(d, rows));
      toast('Tracklist copied.');
    } catch {
      toast('Clipboard blocked; select the text and copy it instead.', 3500);
    }
  };
  head.appendChild(copy);
  host.appendChild(head);
  for (const r of rows) {
    const t = r.track;
    const row = el('div', { class: 'trackrow' });
    const chip = el('span', { class: `deckchip ${r.ref.deck ? `deck-${r.ref.deck.toLowerCase()}` : 'deck-any'}` }, r.ref.deck ?? '•');
    chip.title = r.ref.deck ? `Deck ${r.ref.deck}` : 'Either deck';
    const body = el('div', { class: 'trackbody' });
    body.innerHTML = `<div class="trackname"><b>${escapeHtml(t.artist)}</b> – ${escapeHtml(t.title)}${t.mix ? ` <span class="mix">${escapeHtml(t.mix)}</span>` : ''}</div>
      <div class="trackmeta mono">${t.bpm} BPM · ${t.key ? escapeHtml(t.key) : 'no key'}${t.year ? ` · ${t.year}` : ''} · ${escapeHtml(t.genre)}</div>
      <div class="trackcue">${escapeHtml(r.ref.cue)}</div>
      <div class="trackstructure hint">${escapeHtml(t.structure)}</div>`;
    const actions = el('div', { class: 'trackactions' });
    if (opts.onTempo) {
      const use = el('button', { class: 'small', type: 'button', title: 'Run the highway at this record\'s tempo' }, `Use ${t.bpm}`);
      use.onclick = () => opts.onTempo?.(t.bpm);
      actions.appendChild(use);
    }
    const link = el('a', { class: 'small ghost', href: t.url, target: '_blank', rel: 'noopener' }, 'Key & BPM');
    actions.appendChild(link);
    row.append(chip, body, actions);
    host.appendChild(row);
  }
  return host;
}

/** CSV of every drill's suggested tracks, for building the crate in rekordbox or Beatport. */
export function tracksCsv(drills: Drill[]): string {
  const q = (s: string | number | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = ['drill,deck,artist,title,mix,bpm,key,genre,year,cue,structure,url'];
  for (const d of drills) {
    for (const r of resolveTracks(d)) {
      const t = r.track;
      lines.push([d.name, r.ref.deck ?? '', t.artist, t.title, t.mix ?? '', t.bpm, t.key ?? '', t.genre, t.year ?? '', r.ref.cue, t.structure, t.url].map(q).join(','));
    }
  }
  return lines.join('\n');
}
