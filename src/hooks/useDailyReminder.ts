import { useEffect } from "react";

/**
 * Local 8:00 AM study nudge. Pure client-side so it respects the device's own
 * timezone without storing anything server-side.
 */
const KEY_ENABLED = "studytime.daily_reminders";
const KEY_LAST = "studytime.daily_reminder_last";
const HOUR = 8;

const MESSAGES: { title: string; body: string }[] = [
  { title: "Good morning ☀️", body: "Your brain is sharpest 2h after waking. Grab 25 minutes and keep the streak alive." },
  { title: "Streak check 🔥", body: "Studying today beats studying twice tomorrow — spacing wins. One session, let's go." },
  { title: "Tiny start, big day 🌱", body: "Open a subject and do 10 minutes. Momentum does the rest." },
  { title: "Fun fact 🧠", body: "Recalling beats rereading by ~50%. Do a quick review and lock it in." },
  { title: "Your future self says hi 👋", body: "They'd really appreciate one focused session this morning." },
  { title: "Don't break the chain ⛓️", body: "Streaks are the cheapest motivation there is. Claim today's." },
];

function nextRun(): number {
  const now = new Date();
  const t = new Date(now);
  t.setHours(HOUR, 0, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

function todayKey(): string {
  return new Date().toDateString();
}

function fire() {
  if (localStorage.getItem(KEY_ENABLED) === "0") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (localStorage.getItem(KEY_LAST) === todayKey()) return;
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  try {
    new Notification(msg.title, { body: msg.body, icon: "/icon-192.png", tag: "studytime-daily" });
    localStorage.setItem(KEY_LAST, todayKey());
  } catch {
    // notifications unavailable on this surface
  }
}

export function useDailyReminder() {
  useEffect(() => {
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        fire();
        schedule();
      }, nextRun());
    };

    // Catch up if the app opens after 8am and today's nudge never fired.
    const catchUp = () => {
      if (new Date().getHours() >= HOUR) fire();
    };

    catchUp();
    schedule();
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, []);
}
