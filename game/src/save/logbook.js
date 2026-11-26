// The logbook: sorties flown, gates taken and the best courier run, kept in local storage.

const KEY = 'skybird-courier.logbook.v1';

const EMPTY = { sorties: 0, gates: 0, bestRun: null, medals: [] };

export function readLogbook() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export function writeLogbook(book) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* a blocked storage still flies */
  }
}

export function recordSortie(result) {
  const book = readLogbook();
  book.sorties += 1;
  book.gates += result.gates;
  if (result.completed) book.medals.push(result.chosen);
  if (result.completed && (book.bestRun === null || result.seconds < book.bestRun)) book.bestRun = Math.round(result.seconds);
  writeLogbook(book);
  return book;
}
