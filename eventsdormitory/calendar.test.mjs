import test from "node:test";
import assert from "node:assert/strict";
import "./web/calendar.js";
const C = globalThis.DormCalendar;
const now = new Date("2026-10-08T10:00:00+03:00");
const event = (day, category = "Вместе") => ({
  date: `${day}T19:00:00+03:00`,
  category,
});

test("Moscow calendar date is independent of client timezone, including midnight", () => {
  assert.equal(C.dayKey("2026-10-07T22:30:00Z"), "2026-10-08");
  assert.equal(C.dayKey("2026-10-08T20:30:00Z"), "2026-10-08");
});
test("initial range starts today and ends at month boundary", () => {
  assert.deepEqual(C.selectMonth("2026-10", false, "2026-10-08"), {
    month: "2026-10",
    from: "2026-10-08",
    to: "2026-10-31",
    awaitingEnd: false,
  });
  assert.equal(
    C.selectMonth("2026-11", false, "2026-10-08").from,
    "2026-11-01",
  );
});
test("single day, inclusive period, and reversed selection", () => {
  let s = C.selectDay(
    C.selectMonth("2026-10", false, "2026-10-08"),
    "2026-10-18",
  );
  assert.ok(C.matches(event("2026-10-18"), s, false, "Все", now));
  assert.equal(C.matches(event("2026-10-25"), s, false, "Все", now), false);
  s = C.selectDay(s, "2026-10-25");
  assert.ok(C.matches(event("2026-10-25"), s, false, "Все", now));
  assert.ok(C.matches(event("2026-10-23"), s, false, "Все", now));
  assert.equal(C.matches(event("2026-10-31"), s, false, "Все", now), false);
  s = C.selectDay(C.selectDay(s, "2026-10-31"), "2026-10-18");
  assert.equal(s.from, "2026-10-18");
  assert.equal(s.to, "2026-10-31");
});
test("category, archive, and period apply together", () => {
  const s = C.selectMonth("2026-10", false, "2026-10-08");
  assert.equal(
    C.matches(event("2026-10-18", "Технологии"), s, false, "Спорт", now),
    false,
  );
  assert.ok(
    C.matches(event("2026-10-18", "Технологии"), s, false, "Технологии", now),
  );
  assert.equal(C.matches(event("2026-11-08"), s, false, "Все", now), false);
  const archive = C.selectMonth("2026-09", true, "2026-10-08");
  assert.ok(C.matches(event("2026-09-26"), archive, true, "Все", now));
  assert.equal(
    C.matches(event("2026-09-26"), archive, false, "Все", now),
    false,
  );
});
test("month navigation crosses years and handles leap years", () => {
  assert.equal(C.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(C.shiftMonth("2027-01", -1), "2026-12");
  assert.equal(C.monthDays("2028-02").length, 29);
  assert.equal(C.monthDays("2026-02").length, 28);
});
