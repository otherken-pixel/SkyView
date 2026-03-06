var _MIN_LS_KEY = 'skyview_personal_minimums';

export function getPersonalMinimums() {
    try { var r = localStorage.getItem(_MIN_LS_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}

export function savePersonalMinimums(mins) {
    if (mins) localStorage.setItem(_MIN_LS_KEY, JSON.stringify(mins));
    else localStorage.removeItem(_MIN_LS_KEY);
}
