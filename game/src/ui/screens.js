// The three screens around the flying: title, pause and the sortie report.

export function createScreens() {
  const title = document.getElementById('title');
  const pause = document.getElementById('pause');
  const result = document.getElementById('result');

  return {
    title,
    showTitle() {
      title.classList.remove('hidden');
      pause.classList.add('hidden');
      result.classList.add('hidden');
    },
    hideAll() {
      title.classList.add('hidden');
      pause.classList.add('hidden');
      result.classList.add('hidden');
    },
    // Pausing takes the instruments off the glass too: a stopped sortie should not look live.
    showPause(show) {
      pause.classList.toggle('hidden', !show);
      document.getElementById('hud').classList.toggle('hidden-hud', show);
    },
    report({ completed, headline, detail, gates, seconds, hull, missions }) {
      document.getElementById('r-title').textContent = completed ? 'SORTIE COMPLETE' : 'SORTIE LOST';
      document.getElementById('r-text').textContent = completed ? detail : headline;
      const tally = document.getElementById('r-tally');
      tally.innerHTML = '';
      const cells = [
        ['OBJECTIVES', `${gates}/${missions}`],
        ['ELAPSED', `${seconds < 60 ? seconds.toFixed(1) : `${Math.round(seconds)}`}s`],
        ['WING LEFT', `${Math.max(0, Math.round(hull))}%`],
      ];
      for (const [label, value] of cells) {
        const cell = document.createElement('span');
        cell.innerHTML = `<b>${value}</b>${label}`;
        tally.append(cell);
      }
      document.getElementById('hud').classList.add('hidden-hud');
      result.classList.remove('hidden');
    },
  };
}
