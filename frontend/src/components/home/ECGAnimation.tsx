export default function ECGAnimation() {
  return (
    <div className="w-full overflow-hidden" style={{ height: '60px' }}>
      <svg viewBox="0 0 800 60" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#0EA5E9" stopOpacity="0" />
            <stop offset="30%"  stopColor="#0EA5E9" stopOpacity="1" />
            <stop offset="70%"  stopColor="#14B8A6" stopOpacity="1" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="ecg-path"
          d="M0,30 L60,30 L80,30 L90,10 L100,50 L110,5 L125,55 L135,30 L160,30
             L180,30 L190,10 L200,50 L210,5 L225,55 L235,30 L260,30
             L280,30 L290,10 L300,50 L310,5 L325,55 L335,30 L360,30
             L380,30 L390,10 L400,50 L410,5 L425,55 L435,30 L460,30
             L480,30 L490,10 L500,50 L510,5 L525,55 L535,30 L560,30
             L580,30 L590,10 L600,50 L610,5 L625,55 L635,30 L660,30
             L680,30 L690,10 L700,50 L710,5 L725,55 L735,30 L800,30"
          fill="none"
          stroke="url(#ecgGrad)"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}
