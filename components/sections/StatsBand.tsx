const stats = [
  { value: '10+', label: 'Years of Excellence' },
  { value: '500+', label: 'Happy Clients' },
  { value: '5.0', label: 'Google Rating' },
]

export default function StatsBand() {
  return (
    <div className="bg-ink text-paper">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-3 divide-x divide-white/10">
          {stats.map(({ value, label }) => (
            <div key={label} className="py-10 px-4 sm:px-8 text-center">
              <p
                className="font-display font-light mb-1"
                style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}
              >
                {value}
              </p>
              <p className="text-[10px] tracking-[.18em] uppercase text-white/50">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
