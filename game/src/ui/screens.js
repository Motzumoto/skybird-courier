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
    showPause(show) {
      pause.classList.toggle('hidden', !show);
    },
    report({ completed, headline, detail, gates, seconds, hull, missions }) {
      document.getElementById('r-title').textContent = completed ? 'SORTIE COMPLETE' : 'SORTIE LOST';
      document.getElementById('r-text').textContent = completed ? detail : headline;
      const tally = document.getElementById('r-tally');
      tally.innerHTML = '';
      const cells = [
        ['GATES', `${gates}/${missions}`],
        ['TIME', `${Math.round(seconds)}s`],
        ['AIRFRAME', `${Math.max(0, Math.round(hull))}%`],
      ];
      for (const [label, value] of cells) {
        const cell = document.createElement('span');
        cell.innerHTML = `<b>${value}</b>${label}`;
        tally.append(cell);
      }
      result.classList.remove('hidden');
    },
  };
}
