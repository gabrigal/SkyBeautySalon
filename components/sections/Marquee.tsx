const items = [
  'Precision Haircuts',
  'Color & Highlights',
  'Brazilian Blowout',
  'Keratin Treatment',
  'Balayage & Ombré',
  'Extensions',
  'Threading & Waxing',
  'Facials & Make Up',
]

export default function Marquee() {
  const doubled = [...items, ...items]

  return (
    <div className="border-b border-rule py-4 overflow-hidden bg-paper">
      <div className="animate-marquee flex gap-16 whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="text-[10px] tracking-[.16em] uppercase text-mid flex items-center gap-8"
          >
            <span className="inline-block w-1 h-1 rounded-full bg-rule" aria-hidden="true" />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
