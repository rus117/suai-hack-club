// Date arithmetic uses UTC for calendar days and Moscow for event timestamps.
// Keeping these separate avoids off-by-one days on visitors' local timezones.
(() => {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function dayKey(value = new Date()) {
    const parts = Object.fromEntries(
      dateFormatter
        .formatToParts(new Date(value))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function monthDays(month) {
    const [year, number] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
    return Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    );
  }
  function shiftMonth(month, delta) {
    const [year, number] = month.split("-").map(Number);
    return new Date(Date.UTC(year, number - 1 + delta, 1))
      .toISOString()
      .slice(0, 7);
  }
  function selectMonth(month, archive = false, today = dayKey()) {
    const days = monthDays(month);
    return {
      month,
      from: !archive && month === today.slice(0, 7) ? today : days[0],
      to: days.at(-1),
      awaitingEnd: false,
    };
  }
  function selectDay(state, day) {
    if (day.slice(0, 7) !== state.month)
      throw new Error("Day must belong to displayed month");
    if (!state.awaitingEnd)
      return { ...state, from: day, to: day, awaitingEnd: true };
    return {
      ...state,
      from: [state.from, day].sort()[0],
      to: [state.from, day].sort()[1],
      awaitingEnd: false,
    };
  }
  function matches(event, state, archive, category = "Все", now = new Date()) {
    const key = dayKey(event.date);
    return (
      (archive ? new Date(event.date) <= now : new Date(event.date) > now) &&
      key >= state.from &&
      key <= state.to &&
      (category === "Все" || event.category === category)
    );
  }
  globalThis.DormCalendar = Object.freeze({
    dayKey,
    monthDays,
    shiftMonth,
    selectMonth,
    selectDay,
    matches,
  });
})();
