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
                boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.2s, box-shadow 0.2s',
                ...style
            }}
            onMouseOver={(e) => { if (onClick) { e.currentTarget.style.background = 'var(--card-mid)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)'; } }}
            onMouseOut={(e) => { if (onClick) { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.35)'; } }}
        >
            {children}
        </div>
    );
};

export default MdCard;
