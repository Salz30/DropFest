import React from 'react';

interface SkeletonCardProps {
  variant: 'drop' | 'brand' | 'product' | 'order';
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant }) => {
  const baseStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, #F0F0F0 25%, #E0E0E0 50%, #F0F0F0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '4px'
  };

  if (variant === 'drop') {
    return (
      <div style={{ padding: '16px', border: '1px solid #D9D9D9', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
        <div style={{ ...baseStyle, height: '200px', borderRadius: '8px' }} />
        <div style={{ ...baseStyle, height: '24px', width: '70%' }} />
        <div style={{ ...baseStyle, height: '20px', width: '40%' }} />
        <div style={{ ...baseStyle, height: '16px', width: '50%' }} />
      </div>
    );
  }

  if (variant === 'brand') {
    return (
      <div style={{ padding: '16px', border: '1px solid #D9D9D9', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFFFF' }}>
        <div style={{ ...baseStyle, width: '48px', height: '48px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ ...baseStyle, height: '20px', width: '50%' }} />
          <div style={{ ...baseStyle, height: '16px', width: '80%' }} />
        </div>
      </div>
    );
  }

  if (variant === 'product') {
    return (
      <div style={{ padding: '12px', border: '1px solid #D9D9D9', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#FFFFFF' }}>
        <div style={{ ...baseStyle, height: '150px', borderRadius: '8px' }} />
        <div style={{ ...baseStyle, height: '20px', width: '80%' }} />
        <div style={{ ...baseStyle, height: '18px', width: '50%' }} />
      </div>
    );
  }

  // order variant
  return (
    <div style={{ padding: '16px', border: '1px solid #D9D9D9', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...baseStyle, height: '20px', width: '30%' }} />
        <div style={{ ...baseStyle, height: '20px', width: '20%' }} />
      </div>
      <div style={{ ...baseStyle, height: '1px', width: '100%', background: '#E0E0E0' }} />
      <div style={{ ...baseStyle, height: '16px', width: '60%' }} />
      <div style={{ ...baseStyle, height: '16px', width: '40%' }} />
    </div>
  );
};

export default SkeletonCard;
