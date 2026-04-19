'use client'

import { cn } from '@/lib/utils'

interface AmsMarkProps {
  size?: number
  className?: string
}

export function AmsMark({ size = 32, className }: AmsMarkProps) {
  const glyphSize = Math.round(size * 0.58)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--ams-navy) 0%, var(--ams-navy-light) 100%)',
        boxShadow: '0 4px 14px rgba(15,76,129,0.25)',
      }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        <path
          d="M4 22 L26 8 L22 14 L28 14 L14 24 L17 19 L4 22 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
