import React from 'react';

const MdCard = ({ children, style = {}, onClick }) => {
    return (
        <div
            onClick={onClick}
            style={{
                background: 'var(--card)',
                border: '1px solid var(--card-border)',
                borderRadius: '20px',
                padding: '16px',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-card)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.2s, box-shadow 0.2s',
                ...style
            }}
            onMouseOver={(e) => { if (onClick) { e.currentTarget.style.background = 'var(--card-mid)'; e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; } }}
            onMouseOut={(e) => { if (onClick) { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; } }}
        >
            {children}
        </div>
    );
};

export default MdCard;
