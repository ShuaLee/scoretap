export function BaseballField() {
  return (
    <div className="modern-field" role="img" aria-label="Softball diamond">
      <svg className="modern-field-svg" viewBox="0 0 760 520" aria-hidden="true">
        <defs>
          <radialGradient id="fieldGlow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#6d6885" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#252435" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="760" height="520" fill="transparent" />
        <path
          d="M70 210 C214 62 546 62 690 210 L380 496 Z"
          fill="url(#fieldGlow)"
        />
        <path
          d="M380 440 L150 240 L380 40 L610 240 Z"
          fill="#6d6885"
          opacity="0.42"
          stroke="#8a84a4"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M380 440 L150 240 M380 440 L610 240"
          fill="none"
          stroke="#928cac"
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.7"
        />
        <circle cx="380" cy="300" r="44" fill="none" stroke="#8f89a8" strokeWidth="2" opacity="0.72" />
        <text x="380" y="306" fill="#c9c5d8" fontSize="16" fontWeight="600" textAnchor="middle">P</text>
        <Base x={380} y={440} size={30} label="Home" labelY={486} />
        <Base x={610} y={240} size={30} label="1B" labelX={632} labelY={215} />
        <Base x={380} y={40} size={30} label="2B" labelY={16} />
        <Base x={150} y={240} size={30} label="3B" labelX={128} labelY={215} />
      </svg>

      <RunnerTile className="runner-tile runner-tile-first" number="#12" name="Josh S." />
      <RunnerTile className="runner-tile runner-tile-second" number="#7" name="Matt R." />
    </div>
  )
}

type BaseProps = {
  x: number
  y: number
  size: number
  label: string
  labelX?: number
  labelY: number
}

function Base({ x, y, size, label, labelX = x, labelY }: BaseProps) {
  return (
    <g>
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        fill="#ffffff"
        stroke="#e7e5f2"
        strokeWidth="2"
        transform={`rotate(45 ${x} ${y})`}
      />
      <text x={labelX} y={labelY} fill="#f4f2ff" fontSize="14" fontWeight="700" textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

type RunnerTileProps = {
  className: string
  number: string
  name: string
}

function RunnerTile({ className, number, name }: RunnerTileProps) {
  return (
    <div className={className}>
      <span>{number}</span>
      <strong>{name}</strong>
    </div>
  )
}
