import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './TvPanel.css';

// Deben coincidir con App.jsx y ReservationWizard.jsx.
const TABLES = [
    { id: 1, name: 'Sagredo', color: '#3B82F6' },
    { id: 2, name: 'Liern', color: '#EF4444' },
    { id: 3, name: 'Bailen', color: '#22C55E' },
    { id: 4, name: 'Escuela', color: '#EAB308' },
];
const SLOTS = ['09:00', '10:30', '12:00', '16:00', '17:30', '19:00'];
const SESSION_MINUTES = 90;
// Tras el último turno (19:00–20:30) el panel pasa a mostrar el día siguiente.
const LAST_SLOT_END = 20 * 60 + 30;
const REFRESH_MS = 30 * 1000;

const GAME_MODE_LABELS = {
    tres_bandas: 'Tres bandas',
    libre: 'Libre',
    una_banda: 'Una banda',
    cuadro: 'Cuadro',
};

const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const slotMinutes = (slot) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m;
};

const slotEnd = (slot) => {
    const end = slotMinutes(slot) + SESSION_MINUTES;
    return `${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}`;
};

export const TvPanel = () => {
    const [now, setNow] = useState(() => new Date());
    const [reservations, setReservations] = useState([]);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const showingTomorrow = nowMinutes >= LAST_SLOT_END;
    const shownDate = new Date(now);
    if (showingTomorrow) shownDate.setDate(now.getDate() + 1);
    const shownISO = toISO(shownDate);

    // Reloj
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 15 * 1000);
        return () => clearInterval(id);
    }, []);

    // Reservas del día mostrado, refrescadas periódicamente.
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('date', shownISO);
            if (cancelled) return;
            if (error) {
                console.error('Error cargando reservas del panel:', error);
                setError('Sin conexión con el servidor. Reintentando…');
                return;
            }
            setError(null);
            setReservations(data || []);
            setLastUpdate(new Date());
        };
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [shownISO]);

    // Si la TV lleva días encendida, recarga la página de madrugada para
    // coger posibles cambios de la app.
    useEffect(() => {
        if (now.getHours() === 4 && now.getMinutes() === 0) window.location.reload();
    }, [now]);

    const findReservation = (tableId, slot) =>
        reservations.find(r => Number(r.table_id) === tableId && r.time === slot);

    const slotState = (slot) => {
        if (showingTomorrow) return 'upcoming';
        const start = slotMinutes(slot);
        if (nowMinutes >= start + SESSION_MINUTES) return 'past';
        if (nowMinutes >= start) return 'live';
        return 'upcoming';
    };

    const rawDate = shownDate.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
    });
    const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    const clock = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="tv-panel">
            <header className="tv-header">
                <div className="tv-brand">
                    <img src="/club-logo.jpg" alt="" className="tv-logo" />
                    <div>
                        <h1>Club de billar Paterna</h1>
                        <p className="tv-date">
                            {showingTomorrow ? 'Mañana · ' : 'Hoy · '}
                            <span>{dateLabel}</span>
                        </p>
                    </div>
                </div>
                <div className="tv-clock">{clock}</div>
            </header>

            {error && <div className="tv-error">{error}</div>}

            <div className="tv-grid" style={{ '--tables': TABLES.length }}>
                <div className="tv-corner" />
                {TABLES.map(t => (
                    <div key={t.id} className="tv-table-head" style={{ '--table-color': t.color }}>
                        <span className="tv-table-number">Mesa {t.id}</span>
                        <span className="tv-table-name">{t.name}</span>
                    </div>
                ))}

                {SLOTS.map(slot => {
                    const state = slotState(slot);
                    return (
                        <React.Fragment key={slot}>
                            <div className={`tv-slot ${state}`}>
                                <span className="tv-slot-time">{slot}</span>
                                <span className="tv-slot-end">a {slotEnd(slot)}</span>
                                {state === 'live' && <span className="tv-live-badge">EN JUEGO</span>}
                            </div>
                            {TABLES.map(t => {
                                const r = findReservation(t.id, slot);
                                return (
                                    <div
                                        key={t.id}
                                        className={`tv-cell ${state} ${r ? 'booked' : 'free'}`}
                                        style={{ '--table-color': t.color }}
                                    >
                                        {r ? (
                                            <>
                                                <span className="tv-player">{r.customer_name || 'Socio'}</span>
                                                {r.companion_name && (
                                                    <span className="tv-player companion">{r.companion_name}</span>
                                                )}
                                                {r.game_mode && (
                                                    <span className="tv-mode">{GAME_MODE_LABELS[r.game_mode] || r.game_mode}</span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="tv-free">Libre</span>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </div>

            <footer className="tv-footer">
                {lastUpdate && `Actualizado a las ${lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
            </footer>
        </div>
    );
};
