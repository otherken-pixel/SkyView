import React from 'react';

const MdIcon = ({ name, style, className = '' }) => (
    <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);

export default MdIcon;
