"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const SERVICE_CATEGORIES = [
  {
    id: "cut-style",
    label: "Hair Cut & Style",
    priceRange: "$18 – $70",
    services: [
      { id: "womens-cut",    label: "Women's Haircut",            price: "$40 – $65", duration: "60 min",  durationMins: 60  },
      { id: "mens-cut",      label: "Men's Haircut",              price: "$25 – $30", duration: "30 min",  durationMins: 30  },
      { id: "childrens-cut", label: "Children's Haircut",         price: "$18 – $25", duration: "30 min",  durationMins: 30  },
      { id: "blow-dry",      label: "Blow Dry",                   price: "$30 – $40", duration: "45 min",  durationMins: 45  },
      { id: "bridal",        label: "Formal / Up-do / Bridal",   price: "$50 – $70", duration: "2 hrs",   durationMins: 120 },
    ],
  },
  {
    id: "color",
    label: "Color",
    priceRange: "$30 – $80",
    services: [
      { id: "touch-up",      label: "Touch Up",                   price: "$55 – $60", duration: "90 min",  durationMins: 90  },
      { id: "sp-medium",     label: "Single Process — Medium",    price: "$60",       duration: "90 min",  durationMins: 90  },
      { id: "sp-long",       label: "Single Process — Long",      price: "$80",       duration: "2 hrs",   durationMins: 120 },
      { id: "glaze",         label: "Glaze or Semi-Permanent",    price: "$60",       duration: "60 min",  durationMins: 60  },
      { id: "glaze-post",    label: "Glaze Post Color",           price: "$30",       duration: "30 min",  durationMins: 30  },
      { id: "b3-bond",       label: "B3 Brazilian Bond Builder",  price: "$30",       duration: "30 min",  durationMins: 30  },
    ],
  },
  {
    id: "highlight",
    label: "Highlight / Lowlight",
    priceRange: "$125 – $180",
    services: [
      { id: "hi-full",       label: "Full Highlight",             price: "$150 – $170", duration: "2.5 hrs", durationMins: 150 },
      { id: "hi-partial",    label: "Partial Highlight",          price: "$125 – $145", duration: "2 hrs",   durationMins: 120 },
      { id: "balayage",      label: "Balayage or Ombré",         price: "$155 – $180", duration: "3 hrs",   durationMins: 180 },
      { id: "corrective",    label: "Corrective Color",           price: "Consultation", duration: "3+ hrs", durationMins: 180 },
    ],
  },
  {
    id: "straightening",
    label: "Straightening Treatment / Perm",
    priceRange: "$65 – $300",
    services: [
      { id: "relaxer",       label: "Relaxer",                    price: "$65 – $100",  duration: "2 hrs",   durationMins: 120 },
      { id: "waves",         label: "Treatment Waves",            price: "$100",        duration: "90 min",  durationMins: 90  },
      { id: "keratin",       label: "Treatment Keratin",          price: "$100 – $200", duration: "2 hrs",   durationMins: 120 },
      { id: "blowout",       label: "Brazilian Blow Out",         price: "$100 – $200", duration: "2 hrs",   durationMins: 120 },
      { id: "japanese",      label: "Japanese Straightening",     price: "$150 – $300", duration: "3 hrs",   durationMins: 180 },
      { id: "botox",         label: "Hair Botox Treatment",       price: "$100 – $200", duration: "90 min",  durationMins: 90  },
    ],
  },
  {
    id: "treatment",
    label: "Treatment",
    priceRange: "$30 – $100",
    services: [
      { id: "moroccan",      label: "Moroccan Oil Treatment",     price: "$30 – $55",   duration: "45 min",  durationMins: 45  },
      { id: "aveda",         label: "Aveda Dry or Damage Remedy", price: "$30 – $45",   duration: "45 min",  durationMins: 45  },
      { id: "b3-pkg",        label: "B3 Treatment / B3 Package",  price: "$40 – $60",   duration: "60 min",  durationMins: 60  },
      { id: "split-end",     label: "Split End Repairing",        price: "$40 – $100",  duration: "45 min",  durationMins: 45  },
    ],
  },
];

const ALL_SERVICES = SERVICE_CATEGORIES.flatMap(c => c.services);

// Map display time strings to 24h hour values for ISO datetime construction
const TIME_TO_HOUR: Record<string, number> = {
  "9:00 AM": 9, "10:00 AM": 10, "11:00 AM": 11,
  "12:00 PM": 12, "1:00 PM": 13, "2:00 PM": 14,
  "3:00 PM": 15, "4:00 PM": 16, "5:00 PM": 17, "6:00 PM": 18,
};

const TIME_SLOTS = [
  "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM",
  "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM",
];


const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const N8N_WEBHOOK = "https://gabrigal.app.n8n.cloud/webhook/sky-beauty-booking";
const N8N_AVAILABILITY = "https://gabrigal.app.n8n.cloud/webhook/sky-beauty-availability";

interface BookingState {
  service: string | null;
  date: Date | null;
  time: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Service", "Date", "Time", "Confirm"];
  return (
    <div className="flex items-center justify-center gap-0 mb-12">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-sans font-medium transition-all duration-500",
                i + 1 < step
                  ? "bg-gold text-charcoal"
                  : i + 1 === step
                  ? "bg-charcoal text-cream ring-4 ring-charcoal/10"
                  : "bg-light-gray text-warm-gray"
              )}
            >
              {i + 1 < step ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={clsx(
                "text-[9px] tracking-[0.2em] uppercase font-sans hidden sm:block transition-colors duration-300",
                i + 1 === step ? "text-charcoal" : "text-warm-gray"
              )}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={clsx(
                "h-px w-12 sm:w-20 mx-1 transition-all duration-500",
                i + 1 < step ? "bg-gold" : "bg-light-gray"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ServicePicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  return (
    <div>
      <h3 className="font-serif text-2xl font-semibold text-charcoal mb-2 text-center">
        Choose your service
      </h3>
      <p className="text-sm text-warm-gray font-sans text-center mb-8">
        Select a category, then pick your service
      </p>

      <div className="divide-y divide-light-gray border-t border-b border-light-gray">
        {SERVICE_CATEGORIES.map((cat) => {
          const isOpen = openCat === cat.id;
          const selectedInCat = cat.services.find(s => s.id === selected);
          return (
            <div key={cat.id}>
              <button
                onClick={() => setOpenCat(isOpen ? null : cat.id)}
                className="w-full flex items-center justify-between py-4 text-left group"
              >
                <div className="flex items-center gap-3">
                  {selectedInCat && (
                    <svg className="w-4 h-4 text-charcoal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  <div>
                    <span className="font-serif text-base font-semibold text-charcoal group-hover:text-warm-gray transition-colors">
                      {cat.label}
                    </span>
                    {selectedInCat && (
                      <span className="ml-2 text-xs font-sans text-warm-gray">
                        — {selectedInCat.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-sans text-warm-gray hidden sm:inline">{cat.priceRange}</span>
                  <motion.svg
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-4 h-4 text-warm-gray"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 space-y-1">
                      {cat.services.map((svc) => (
                        <button
                          key={svc.id}
                          onClick={() => { onSelect(svc.id); setOpenCat(null); }}
                          className={clsx(
                            "w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-all duration-200",
                            selected === svc.id
                              ? "bg-charcoal text-cream"
                              : "bg-gray-50 hover:bg-light-gray text-charcoal"
                          )}
                        >
                          <span className="font-sans text-sm">{svc.label}</span>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <span className={clsx("font-sans text-sm font-medium", selected === svc.id ? "text-cream" : "text-charcoal")}>
                              {svc.price}
                            </span>
                            <span className={clsx("text-[10px] font-sans tracking-wide w-14 text-right", selected === svc.id ? "text-cream/60" : "text-warm-gray")}>
                              {svc.duration}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarPicker({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const { year, month, days } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return { year, month, days };
  }, [viewDate]);

  const prevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="max-w-sm mx-auto">
      <h3 className="font-serif text-2xl font-semibold text-charcoal mb-2 text-center">
        Pick a date
      </h3>
      <p className="text-sm text-warm-gray font-sans text-center mb-8">
        Available appointments shown below
      </p>

      <div className="bg-white rounded-2xl border border-light-gray p-6 shadow-sm">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            disabled={
              viewDate.getFullYear() === today.getFullYear() &&
              viewDate.getMonth() === today.getMonth()
            }
            className="w-8 h-8 rounded-full border border-light-gray flex items-center justify-center hover:border-gold hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h4 className="font-serif text-base font-semibold text-charcoal">
            {MONTHS[month]} {year}
          </h4>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full border border-light-gray flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[9px] tracking-[0.2em] uppercase font-sans text-warm-gray py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const isPast = day < today;
            const isSelected = selected && isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            return (
              <motion.button
                key={day.toISOString()}
                whileHover={!isPast ? { scale: 1.12 } : {}}
                whileTap={!isPast ? { scale: 0.96 } : {}}
                onClick={() => !isPast && onSelect(day)}
                disabled={isPast}
                className={clsx(
                  "aspect-square flex items-center justify-center rounded-full text-sm font-sans transition-all duration-200 mx-auto w-9 h-9",
                  isPast && "text-light-gray cursor-not-allowed",
                  !isPast && !isSelected && "hover:bg-gold-light text-charcoal cursor-pointer",
                  isToday && !isSelected && "border border-gold text-gold font-medium",
                  isSelected && "bg-charcoal text-cream font-medium shadow-md"
                )}
              >
                {day.getDate()}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimePicker({
  selected,
  onSelect,
  takenSlots,
  slotsLoading,
  selectedDate,
}: {
  selected: string | null;
  onSelect: (t: string) => void;
  takenSlots: Set<string>;
  slotsLoading: boolean;
  selectedDate: Date | null;
}) {
  const now = new Date();
  const isToday =
    selectedDate !== null &&
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();
  const currentHour = now.getHours();

  return (
    <div className="max-w-md mx-auto">
      <h3 className="font-serif text-2xl font-semibold text-charcoal mb-2 text-center">
        Select a time
      </h3>
      <p className="text-sm text-warm-gray font-sans text-center mb-8">
        {slotsLoading ? "Checking availability…" : "Tap a slot to confirm your preferred time"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TIME_SLOTS.map((t) => {
          const booked = takenSlots.has(t);
          const past = isToday && TIME_TO_HOUR[t] <= currentHour;
          const disabled = booked || past || slotsLoading;

          return (
            <motion.button
              key={t}
              whileHover={!disabled ? { scale: 1.04 } : {}}
              whileTap={!disabled ? { scale: 0.96 } : {}}
              onClick={() => !disabled && onSelect(t)}
              disabled={disabled}
              className={clsx(
                "relative py-3 px-4 rounded-xl border text-sm font-sans transition-all duration-300",
                slotsLoading
                  ? "border-light-gray text-light-gray cursor-wait animate-pulse"
                  : booked
                  ? "border-light-gray bg-gray-50 text-light-gray cursor-not-allowed line-through decoration-light-gray"
                  : past
                  ? "border-light-gray bg-gray-50 text-light-gray cursor-not-allowed line-through decoration-light-gray/50"
                  : selected === t
                  ? "border-charcoal bg-charcoal text-cream shadow-md"
                  : "border-light-gray bg-white hover:border-gold hover:shadow-sm text-charcoal"
              )}
            >
              {t}
              {booked && !slotsLoading && (
                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] tracking-wide text-light-gray/80 font-sans">
                  booked
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmStep({
  booking,
  onBookingChange,
  onConfirm,
  submitting,
}: {
  booking: BookingState;
  onBookingChange: (fields: Partial<BookingState>) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const service = ALL_SERVICES.find((s) => s.id === booking.service);
  const dateStr = booking.date?.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const isValid = booking.customerName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.customerEmail);

  return (
    <div className="max-w-md mx-auto">
      <h3 className="font-serif text-2xl font-semibold text-charcoal mb-2 text-center">
        Your details
      </h3>
      <p className="text-sm text-warm-gray font-sans text-center mb-8">
        Almost done — enter your info and we'll send confirmation emails
      </p>

      {/* Contact fields */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase font-sans text-warm-gray block mb-1.5">
            Full Name *
          </label>
          <input
            type="text"
            value={booking.customerName}
            onChange={e => onBookingChange({ customerName: e.target.value })}
            placeholder="Jane Smith"
            className="w-full px-4 py-3 rounded-xl border border-light-gray bg-white text-charcoal text-sm font-sans placeholder:text-warm-gray/50 focus:outline-none focus:border-charcoal transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase font-sans text-warm-gray block mb-1.5">
            Email Address *
          </label>
          <input
            type="email"
            value={booking.customerEmail}
            onChange={e => onBookingChange({ customerEmail: e.target.value })}
            placeholder="jane@example.com"
            className="w-full px-4 py-3 rounded-xl border border-light-gray bg-white text-charcoal text-sm font-sans placeholder:text-warm-gray/50 focus:outline-none focus:border-charcoal transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase font-sans text-warm-gray block mb-1.5">
            Phone Number
          </label>
          <input
            type="tel"
            value={booking.customerPhone}
            onChange={e => onBookingChange({ customerPhone: e.target.value })}
            placeholder="(555) 000-1234"
            className="w-full px-4 py-3 rounded-xl border border-light-gray bg-white text-charcoal text-sm font-sans placeholder:text-warm-gray/50 focus:outline-none focus:border-charcoal transition-colors"
          />
        </div>
      </div>

      {/* Booking summary */}
      <div className="bg-white rounded-2xl border border-light-gray p-5 mb-6 shadow-sm">
        <p className="text-[10px] tracking-[0.2em] uppercase font-sans text-warm-gray mb-3">Appointment Summary</p>
        <div className="space-y-0">
          {[
            { label: "Service", value: service?.label || "" },
            { label: "Date", value: dateStr || "" },
            { label: "Time", value: booking.time || "" },
            { label: "Price", value: service?.price || "" },
            { label: "Duration", value: service?.duration || "" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-light-gray last:border-0">
              <span className="text-xs tracking-[0.15em] uppercase font-sans text-warm-gray">{label}</span>
              <span className="font-sans text-sm text-charcoal font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={!isValid || submitting}
        className={clsx(
          "w-full py-4 text-xs tracking-[0.25em] uppercase font-sans rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-2",
          isValid && !submitting
            ? "bg-charcoal text-cream hover:bg-gold cursor-pointer"
            : "bg-light-gray text-warm-gray cursor-not-allowed"
        )}
      >
        {submitting ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending confirmation…
          </>
        ) : (
          "Confirm Appointment"
        )}
      </button>
      <p className="mt-3 text-[10px] text-warm-gray font-sans text-center">
        You'll receive a confirmation email instantly · Free cancellation up to 24h before
      </p>
    </div>
  );
}

function SuccessScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="text-center py-8"
    >
      {/* Animated glow ring */}
      <div className="relative inline-flex mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.8, times: [0, 0.6, 1] }}
          className="w-20 h-20 rounded-full bg-gold/20 absolute inset-0 m-auto"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative w-20 h-20 rounded-full bg-gold flex items-center justify-center"
        >
          <svg className="w-9 h-9 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="font-serif text-3xl font-semibold text-charcoal mb-3">
          You&rsquo;re booked!
        </h3>
        <p className="font-sans font-light text-warm-gray mb-2 max-w-xs mx-auto leading-relaxed">
          Your appointment has been confirmed. A confirmation email is on its way.
        </p>
        <p className="text-xs font-sans text-gold tracking-wide">
          We can&rsquo;t wait to see you ✦
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function BookingSection() {
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState<BookingState>({
    service: null,
    date: null,
    time: null,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [takenSlots, setTakenSlots] = useState<Set<string>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);

  const fetchAvailability = useCallback(async (date: Date) => {
    setSlotsLoading(true);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateISO = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    try {
      const res = await fetch(`${N8N_AVAILABILITY}?date=${dateISO}`);
      const data = await res.json();
      setTakenSlots(new Set(data.taken || []));
    } catch {
      setTakenSlots(new Set()); // on error, show all slots as available
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (step === 2 && booking.date) {
      fetchAvailability(booking.date);
    }
    setStep((s) => s + 1);
  }, [step, booking.date, fetchAvailability]);

  const canAdvance =
    (step === 1 && !!booking.service) ||
    (step === 2 && !!booking.date) ||
    (step === 3 && !!booking.time);

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const service = ALL_SERVICES.find(s => s.id === booking.service);
    const date = booking.date!;
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });

    // Build ISO datetimes for Google Calendar
    const hour = TIME_TO_HOUR[booking.time ?? ""] ?? 10;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateISO = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const startISO = `${dateISO}T${pad(hour)}:00:00`;
    const endHour = Math.floor((hour * 60 + (service?.durationMins ?? 60)) / 60);
    const endMin  = (hour * 60 + (service?.durationMins ?? 60)) % 60;
    const endISO  = `${dateISO}T${pad(endHour)}:${pad(endMin)}:00`;

    try {
      await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:  booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone || "Not provided",
          service:       service?.label ?? booking.service,
          date:          dateStr,
          dateISO,
          time:          booking.time,
          startISO,
          endISO,
          price:         service?.price ?? "",
          duration:      service?.duration ?? "",
        }),
      });
      setConfirmed(true);
    } catch {
      setSubmitError("Could not send booking. Please call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setBooking({ service: null, date: null, time: null, customerName: "", customerEmail: "", customerPhone: "" });
    setConfirmed(false);
    setSubmitError(null);
    setTakenSlots(new Set());
  };

  return (
    <section id="booking" className="section-pad bg-cream">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-3 mb-5"
          >
            <span className="h-px w-8 bg-gold" />
            <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gold">
              Reservations
            </span>
            <span className="h-px w-8 bg-gold" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl font-semibold text-charcoal"
          >
            Book your
            <br />
            <span className="text-gray-500">appointment.</span>
          </motion.h2>
        </div>

        {/* Booking card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="bg-white rounded-3xl border border-light-gray shadow-xl shadow-charcoal/5 p-8 md:p-12"
        >
          {confirmed ? (
            <>
              <SuccessScreen />
              <div className="text-center mt-8">
                <button
                  onClick={reset}
                  className="text-xs font-sans text-warm-gray hover:text-gold transition-colors underline underline-offset-4"
                >
                  Book another appointment
                </button>
              </div>
            </>
          ) : (
            <>
              <StepIndicator step={step} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {step === 1 && (
                    <ServicePicker
                      selected={booking.service}
                      onSelect={(id) => setBooking((b) => ({ ...b, service: id }))}
                    />
                  )}
                  {step === 2 && (
                    <CalendarPicker
                      selected={booking.date}
                      onSelect={(date) => setBooking((b) => ({ ...b, date }))}
                    />
                  )}
                  {step === 3 && (
                    <TimePicker
                      selected={booking.time}
                      onSelect={(time) => setBooking((b) => ({ ...b, time }))}
                      takenSlots={takenSlots}
                      slotsLoading={slotsLoading}
                      selectedDate={booking.date}
                    />
                  )}
                  {step === 4 && (
                    <ConfirmStep
                      booking={booking}
                      onBookingChange={(fields) => setBooking(b => ({ ...b, ...fields }))}
                      onConfirm={handleConfirm}
                      submitting={submitting}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Submit error */}
              {submitError && (
                <p className="text-center text-xs text-red-500 font-sans mt-4">{submitError}</p>
              )}

              {/* Navigation */}
              {step < 4 && (
                <div className="flex items-center justify-between mt-10 pt-6 border-t border-light-gray">
                  <button
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    className={clsx(
                      "flex items-center gap-2 text-xs font-sans tracking-[0.15em] uppercase transition-colors",
                      step === 1 ? "text-light-gray cursor-not-allowed" : "text-warm-gray hover:text-charcoal"
                    )}
                    disabled={step === 1}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back
                  </button>

                  <motion.button
                    whileHover={canAdvance ? { scale: 1.03 } : {}}
                    whileTap={canAdvance ? { scale: 0.97 } : {}}
                    onClick={() => canAdvance && handleNext()}
                    disabled={!canAdvance}
                    className={clsx(
                      "flex items-center gap-2 px-8 py-3 rounded-full text-xs tracking-[0.2em] uppercase font-sans transition-all duration-300",
                      canAdvance
                        ? "bg-charcoal text-cream hover:bg-gold shadow-lg shadow-charcoal/15"
                        : "bg-light-gray text-warm-gray cursor-not-allowed"
                    )}
                  >
                    {step === 3 ? "Review" : "Continue"}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </motion.button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
