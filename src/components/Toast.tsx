import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {toasts.map((toast) => {
        let IconComponent = Info;
        let borderColor = '#0369A1';
        
        switch (toast.type) {
          case 'success':
            IconComponent = CheckCircle2;
            borderColor = '#15803D';
            break;
          case 'error':
            IconComponent = AlertCircle;
            borderColor = '#D32F2F';
            break;
          case 'warning':
            IconComponent = AlertTriangle;
            borderColor = '#D97706';
            break;
          case 'info':
            IconComponent = Info;
            borderColor = '#0369A1';
            break;
        }

        return (
          <div key={toast.id} style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '8px',
            borderLeft: `4px solid ${borderColor}`,
            padding: '12px 16px',
            maxWidth: '380px',
            minWidth: '300px',
            animation: 'slideInRight 0.3s ease-out forwards',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <IconComponent size={20} color={borderColor} />
              <span style={{ color: '#3D464D', fontSize: '14px', lineHeight: '1.4' }}>{toast.message}</span>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#75797C'
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toast;
