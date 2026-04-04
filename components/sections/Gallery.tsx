import Image from 'next/image'

const photos = [
  { src: '/assets/hair-1.webp', label: 'Color & Cut',         num: '01', tall: true },
  { src: '/assets/hair-2.webp', label: 'Curls & Color',       num: '02', tall: false },
  { src: '/assets/hair-3.webp', label: 'Balayage',            num: '03', tall: false },
  { src: '/assets/hair-4.jpg',  label: 'Style & Volume',      num: '04', tall: false },
  { src: '/assets/hair-5.webp', label: 'Highlights',          num: '05', tall: false },
  { src: '/assets/hair-6.webp', label: 'Full Transformation', num: '06', tall: false },
]

export default function Gallery() {
  return (
    <section id="gallery" className="bg-ink py-24 lg:py-36">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 mb-12">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[.22em] uppercase text-white/40 mb-4">Portfolio</p>
            <h2
              className="font-display font-light text-paper leading-[.9] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(3rem,7vw,5.5rem)' }}
            >
              Our<br /><em>Work</em>
            </h2>
          </div>
          <p className="text-sm font-light text-white/50 max-w-xs">
            A selection of transformations created right here in our salon.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 px-1">
        {photos.map((photo) => (
          <div
            key={photo.num}
            className={`group relative overflow-hidden ${photo.tall ? 'lg:row-span-2' : ''}`}
            style={{ aspectRatio: photo.tall ? '3/4' : '4/3' }}
          >
            <Image
              src={photo.src}
              alt={photo.label}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ filter: 'grayscale(25%)' }}
            />
            <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity duration-350 flex items-end p-5 lg:p-6">
              <div>
                <p className="text-[9px] tracking-[.2em] uppercase text-white/60 mb-1">{photo.num}</p>
                <p className="text-sm tracking-wide text-paper">{photo.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
