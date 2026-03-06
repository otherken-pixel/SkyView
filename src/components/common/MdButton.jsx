import React from 'react';
import MdIcon from './MdIcon';

const MdButton = ({ onClick, variant = 'primary', icon, children, disabled, style = {} }) => {
    const baseStyle = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '10px 24px', borderRadius: '9999px', fontSize: '14px', fontWeight: '500',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', letterSpacing: '0.1px',
        opacity: disabled ? 0.5 : 1, ...style
    };

    const variants = {
        primary: {
            background: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)'
        },
        tonal: {
            background: 'var(--md-sys-color-secondary-container)',
            color: 'var(--md-sys-color-on-secondary-container)'
        },
        text: {
            background: 'transparent',
            color: 'var(--md-sys-color-primary)',
            padding: '10px 16px'
        },
        sparkle: {
            background: 'linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary))',
            color: 'var(--md-sys-color-on-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{ ...baseStyle, ...variants[variant] }}
            onMouseOver={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.9)'; }}
            onMouseOut={(e) => { if (!disabled) e.currentTarget.style.filter = 'none'; }}
        >
            {icon && <MdIcon name={icon} style={{ fontSize: '18px' }} />}
            {children}
        </button>
    );
};

export default MdButton;
