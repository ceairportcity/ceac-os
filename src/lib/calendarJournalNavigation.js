export const calendarJournalLeaveEvent = "ceac:leave-calendar-journal";

export function canLeaveCalendarJournal() {
  return window.dispatchEvent(new Event(calendarJournalLeaveEvent, { cancelable: true }));
}
