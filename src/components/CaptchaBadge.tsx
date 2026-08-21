import React from 'react'
import { ShieldCheck, Lock } from 'lucide-react'

interface CaptchaBadgeProps {
  style?: React.CSSProperties
  compact?: boolean
}

/**
 * Invisible reCAPTCHA v3 / Anti-Bot Shield Badge
 * Provides user assurance and visual verification for anti-bot protection.
 */
export const CaptchaBadge: React.FC<CaptchaBadgeProps> = ({ style, compact = false }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: compact ? '4px 8px' : '8px 12px',
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 6,
        fontSize: 11,
        color: '#64748B',
        fontWeight: 600,
        ...style,
      }}
    >
      <ShieldCheck size={14} color="#15803D" style={{ flexShrink: 0 }} />
      <span>
        Protected by <strong>Anti-Bot Shield</strong> & <strong>reCAPTCHA v3</strong>
      </span>
      <Lock size={11} color="#94A3B8" style={{ marginLeft: 2 }} />
    </div>
  )
}
