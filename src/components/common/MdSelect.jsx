import React from 'react';

const MdSelect = ({ label, value, onChange, options, containerStyle = {} }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, ...containerStyle }}>
            {label && <label style={{ fontSize: "12px", fontWeight: "500", color: "var(--md-sys-color-on-surface-variant)" }}>{label}</label>}
            <select
                value={value} onChange={onChange}
                style={{
                    background: "var(--md-sys-color-surface-variant)",
                    border: "none", borderBottom: "2px solid var(--md-sys-color-outline)",
                    borderRadius: "4px 4px 0 0", padding: "12px 16px",
                    color: "var(--md-sys-color-on-surface)",
                    fontFamily: "inherit", fontSize: "16px", outline: "none",
                    width: "100%", boxSizing: "border-box"
                }}
                onFocus={(e) => e.target.style.borderBottomColor = "var(--md-sys-color-primary)"}
                onBlur={(e) => e.target.style.borderBottomColor = "var(--md-sys-color-outline)"}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
};

export default MdSelect;
