"use client";

// Adapted from Skillry Activity Calendar 1.0.1 and Masonry Testimonial Wall 1.0.3.
// Their MIT permission notice is retained in THIRD_PARTY_SKILLRY.txt.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/lib/i18n";
import { saveProductReview, deleteProductReview } from "@/server/community-actions";
import { communityCopy } from "./copy";
import "./community.css";

type Review = { id: string; userId: string; name: string; body: string; rating: number; updatedAt: string };
const COLORS = ["#ece6dc", "#a8d5cf", "#5fb3a8", "#2f8b81", "#17605c"];

export function CommunityView({ locale, today, days, counts, userId, reviews }: { locale: Locale; today: string; days: string[]; counts: Record<string, number>; userId: string; reviews: Review[] }) {
  const t = communityCopy[locale];
  const [selected, setSelected] = useState(today);
  const [removing, startRemove] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [state, action, pending] = useActionState(saveProductReview, null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const calendarScroll = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduced = useReducedMotion();
  const own = reviews.find(review => review.userId === userId);
  const [body, setBody] = useState(own?.body ?? "");
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [consent, setConsent] = useState(Boolean(own));
  const activeDays = days.filter(day => day <= today && (counts[day] || 0) > 0).length;
  const formatDate = (day: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${day.slice(0,10)}T12:00:00Z`));
  useEffect(() => { if (calendarScroll.current) calendarScroll.current.scrollLeft = calendarScroll.current.scrollWidth; }, []);
  useEffect(() => {
    if (state?.ok) { dialog.current?.close(); router.refresh(); }
  }, [state, router]);

  return <div className="community-page">
    <header className="community-heading"><h1>{t.title}</h1><p>{t.subtitle}</p></header>
    <section className="activity-panel" aria-labelledby="activity-heading">
      <div className="community-section-heading"><div><h2 id="activity-heading">{t.activity}</h2><p>{t.period}</p></div><div className="activity-total"><strong>{activeDays}</strong><span>{t.days}</span></div></div>
      <div className="activity-scroll" ref={calendarScroll} tabIndex={0} role="region" aria-label={t.activity}>
        <div className="activity-months" aria-hidden>{Array.from({ length: 26 }, (_, week) => { const day = days[week * 7]; return <span key={day}>{week === 0 || day.slice(0,7) !== days[(week - 1)*7].slice(0,7) ? formatDate(day, { month: "short" }) : ""}</span>; })}</div>
        <div className="activity-calendar">
          {Array.from({ length: 26 }, (_, week) => <div key={week} className="activity-week">{days.slice(week*7, week*7+7).map(day => {
            const count = counts[day] || 0;
            return <button key={day} type="button" className="activity-day" disabled={day > today} aria-pressed={selected === day} aria-label={`${formatDate(day)}: ${count}`} title={`${formatDate(day)}: ${count}`} style={{ backgroundColor: COLORS[Math.min(count,4)] }} onClick={() => setSelected(day)} />;
          })}</div>)}
        </div>
      </div>
      <div className="activity-caption"><p aria-live="polite"><strong>{formatDate(selected)}</strong><span>{counts[selected] ? `${t.events}: ${counts[selected]}` : t.none}</span></p><div className="activity-legend" aria-hidden><span>{t.less}</span>{COLORS.map(color => <i key={color} style={{ backgroundColor: color }} />)}<span>{t.more}</span></div></div>
      <p className="community-note">{t.note}</p>
    </section>

    <section className="review-section" aria-labelledby="reviews-heading">
      <div className="community-section-heading"><div><h2 id="reviews-heading">{t.reviews}</h2><p>{t.reviewNote}</p></div><button className="community-primary" ref={trigger} onClick={() => dialog.current?.showModal()}>{own ? t.edit : t.write}</button></div>
      {state?.ok && <p className="community-success" role="status">{t.saved}</p>}
      {reviews.length === 0 ? <div className="review-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden><path d="M21 15a3 3 0 0 1-3 3H7l-4 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M7 8h10M7 12h6"/></svg><h3>{t.empty}</h3><p>{t.emptyNote}</p></div> : <ul className="review-wall">{reviews.map(review => <motion.li key={review.id} initial={reduced ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="review-card"><div className="review-rating" aria-label={`${t.rating}: ${review.rating}/5`}>{Array.from({ length: 5 }, (_, i) => <svg key={i} viewBox="0 0 24 24" fill={i < review.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>)}</div><blockquote><p>{review.body}</p><footer><cite>{review.name}</cite><time dateTime={review.updatedAt}>{formatDate(review.updatedAt)}</time></footer></blockquote>{review.userId === userId && <span className="community-own">{t.own}</span>}</motion.li>)}</ul>}
      {own && <div className="review-delete">{confirmDelete ? <><span>{t.removeConfirm}</span><button disabled={removing} onClick={() => startRemove(async () => { const result = await deleteProductReview(); if (result?.ok) { setConfirmDelete(false); router.refresh(); } else setRemoveError(true); })}>{removing ? t.saving : t.confirm}</button><button disabled={removing} onClick={() => setConfirmDelete(false)}>{t.cancel}</button></> : <button onClick={() => setConfirmDelete(true)}>{t.remove}</button>}{removeError && <p role="alert">{t.error}</p>}</div>}
    </section>

    <dialog className="review-dialog" ref={dialog} aria-labelledby="review-dialog-title" onCancel={event => { if (pending) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      <h2 id="review-dialog-title">{own ? t.edit : t.write}</h2>
      <form action={action}>
        <fieldset disabled={pending}><legend>{t.rating}</legend><div className="review-rating-input">{[1,2,3,4,5].map(value => <label key={value}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required /><span>{value}</span></label>)}</div></fieldset>
        <label>{t.body}<textarea name="body" required minLength={10} maxLength={1500} value={body} onChange={event => setBody(event.target.value)} placeholder={t.placeholder} rows={5} disabled={pending} /></label>
        <label className="review-consent"><input type="checkbox" name="consent" value="yes" required checked={consent} onChange={event => setConsent(event.target.checked)} disabled={pending} /><span>{t.consent}</span></label>
        {state && !state.ok && <p role="alert" className="text-danger">{state.error === "Review validation failed" ? t.invalid : t.error}</p>}
        <div className="review-dialog-actions"><button type="button" disabled={pending} onClick={() => dialog.current?.close()}>{t.cancel}</button><button className="community-primary" disabled={pending}>{pending ? t.saving : t.save}</button></div>
      </form>
    </dialog>
  </div>;
}
