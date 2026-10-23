const defaultTimeZone = "America/New_York";
const defaultLaunchDate = "2026-10-15";

function localParts(now, timeZone = defaultTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function gameDate(now = new Date(), timeZone = defaultTimeZone) {
  const value = localParts(now, timeZone);
  const localDate = `${value.year}-${value.month}-${value.day}`;
  return Number(value.hour) < 11 ? shiftDate(localDate, -1) : localDate;
}

export function nextGameDate(date) {
  return shiftDate(date, 1);
}

export function datesAfter(fromDate, throughDate) {
  const dates = [];
  for (let date = nextGameDate(fromDate); date <= throughDate; date = nextGameDate(date)) dates.push(date);
  return dates;
}

export function gameNumber(date, launchDate = process.env.NUZZLE_LAUNCH_DATE || defaultLaunchDate) {
  const day = Date.parse(`${date}T12:00:00Z`);
  const launch = Date.parse(`${launchDate}T12:00:00Z`);
  return Math.max(1, Math.round((day - launch) / 86_400_000) + 1);
}

export function nextRolloverAt(now = new Date(), timeZone = defaultTimeZone) {
  const current = gameDate(now, timeZone);
  let low = now.getTime();
  let high = low + 27 * 60 * 60 * 1000;
  while (gameDate(new Date(high), timeZone) === current) high += 6 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (gameDate(new Date(middle), timeZone) === current) low = middle;
    else high = middle;
  }
  return new Date(Math.floor(high / 1000) * 1000).toISOString();
}

export { defaultLaunchDate, defaultTimeZone };
