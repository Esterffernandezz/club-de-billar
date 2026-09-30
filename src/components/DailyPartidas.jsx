import React, { useState } from 'react';
import { todayLocalISO } from '../dateUtils';
import './DailyPartidas.css';

// Etiquetas de los valores que guarda la reserva (migración 006).
const CATEGORY_LABELS = {
    principiante: '🌱 Principiante',
    avanzado: '⭐ Avanzado',
    competitivo: '🏆 Competitivo',
};

const GAME_MODE_LABELS = {
    tres_bandas: '🎱 Tres bandas',
    libre: '🎯 Libre',
    una_banda: '↩️ Una banda',
    cuadro: '🔲 Cuadro (Balkline)',
};

export const DailyPartidas = ({ reservations, onJoinReservation, memberName, memberId }) => {
    const [showJoinDialog, setShowJoinDialog] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState(null);

    const today = todayLocalISO();

    // Filter reservations for today and sort by time
    const todayReservations = reservations
        .filter(res => res.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));

    const getMonthAbbr = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('default', { month: 'short' }).toUpperCase();
    };

    const getDay = (dateStr) => {
        return dateStr.split('-')[2];
    };

    const getYear = (dateStr) => {
        return dateStr.split('-')[0];
    };

    const handleJoinClick = (reservation) => {
        setSelectedReservation(reservation);
        setShowJoinDialog(true);
    };

    const confirmJoin = () => {
        if (selectedReservation && onJoinReservation) {
            onJoinReservation(selectedReservation.id);
        }
        setShowJoinDialog(false);
        setSelectedReservation(null);
    };

    const cancelJoin = () => {
        setShowJoinDialog(false);
        setSelectedReservation(null);
    };

    // Check if a reservation is joinable (solo and not yet joined)
    const isJoinable = (res) => {
        return res.is_solo === true
            && res.allow_join !== false
            && !res.companion_name
            && String(res.member_id) !== String(memberId);
    };

    return (
        <div className="daily-partidas-container">
            <div className="section-header">
                <h2 className="section-title">Partidas de Hoy</h2>
            </div>

            {todayReservations.length === 0 ? (
                <div className="no-partidas">
                    <p>No hay partidas programadas para hoy.</p>
                </div>
            ) : (
                <div className="partidas-list">
                    {todayReservations.map((res) => (
                        <div key={res.id} className="partida-item">
                            <div className="date-card">
                                <div className="date-header">HORA</div>
                                <div className="date-body">
                                    <span className="time-display">{res.time}</span>
                                </div>
                            </div>
                            <div className="partida-details">
                                <h3 className="partida-title">
                                    Mesa {res.table_id}
                                </h3>
                                <div className="partida-players">
                                    <div className="player-name">
                                        <span className="player-icon">👤</span>
                                        {res.customer_name || 'Socio'}
                                    </div>
                                    {res.companion_name && (
                                        <div className="player-name companion">
                                            <span className="player-icon">👤</span>
                                            {res.companion_name}
                                        </div>
                                    )}
                                </div>
                                {(res.category || res.game_mode) && (
                                    <div className="partida-tags">
                                        {res.game_mode && (
                                            <span className="partida-tag">{GAME_MODE_LABELS[res.game_mode] || res.game_mode}</span>
                                        )}
                                        {res.category && (
                                            <span className="partida-tag">{CATEGORY_LABELS[res.category] || res.category}</span>
                                        )}
                                    </div>
                                )}

                                {/* Show reservation status */}
                                <div className="reservation-status">
                                    {res.is_solo && !res.companion_name ? (
                                        res.allow_join !== false ? (
                                            <span className="status-badge solo">🎱 Solo - Disponible para unirse</span>
                                        ) : (
                                            <span className="status-badge closed">🔒 Solo - No admite que se unan</span>
                                        )
                                    ) : res.companion_name ? (
                                        <span className="status-badge accompanied">👥 Acompañado - {res.companion_name}</span>
                                    ) : (
                                        <span className="status-badge accompanied">👥 Acompañado</span>
                                    )}
                                </div>

                                {/* Show join button if applicable */}
                                {isJoinable(res) && memberName && (
                                    <button
                                        className="join-button"
                                        onClick={() => handleJoinClick(res)}
                                    >
                                        Unirse
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Join confirmation dialog */}
            {showJoinDialog && selectedReservation && (
                <div className="join-dialog-overlay" onClick={cancelJoin}>
                    <div className="join-dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Unirse a la reserva</h3>
                        <p>¿Quieres unirte a esta partida?</p>
                        <div className="dialog-details">
                            <p><strong>Mesa:</strong> {selectedReservation.table_id}</p>
                            <p><strong>Hora:</strong> {selectedReservation.time}</p>
                            <p><strong>Jugador:</strong> {selectedReservation.customer_name}</p>
                            <p><strong>Tu nombre:</strong> {memberName}</p>
                        </div>
                        <p className="dialog-note">
                            Al unirte, la partida pasa a contar 45 min para cada uno: a ti se te
                            suman 0:45 y a {selectedReservation.customer_name} se le descuentan 45 min.
                        </p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={cancelJoin}>Cancelar</button>
                            <button className="btn-confirm" onClick={confirmJoin}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
