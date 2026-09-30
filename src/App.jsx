import { useState, useEffect, useMemo, useRef } from 'react'
import { TableList } from './components/TableList.jsx'
import { ReservationWizard } from './components/ReservationWizard.jsx'
import { AccessPortal } from './components/AccessPortal.jsx'
import { AdminCalendarView } from './components/AdminCalendarView.jsx'
import { MemberManager } from './components/MemberManager.jsx'
import { DailyPartidas } from './components/DailyPartidas.jsx'
import { UsageInfo } from './components/UsageInfo.jsx'
import { useReservations } from './hooks/useReservations.js'
import { useMembers } from './hooks/useMembers.js'
import { todayLocalISO, weekRangeLocalISO } from './dateUtils.js'
import './AppLayout.css'

// Cada sesión dura 1:30. El límite diario es una sesión completa.
const SESSION_HOURS = 1.5;
const DAILY_HOUR_LIMIT = SESSION_HOURS;

// Horas que "gasta" un socio en una reserva: la sesión completa (1:30) si
// juega solo, la mitad (0:45) si va acompañado (sea titular o acompañante).
// Debe coincidir con el criterio de la RPC `_member_daily_hours` en
// supabase/migrations/009_session_90_minutes.sql.
function memberHoursInReservation(reservation, memberId) {
    const isOwner = String(reservation.member_id) === String(memberId);
    const isCompanion = String(reservation.companion_member_id) === String(memberId);
    if (!isOwner && !isCompanion) return 0;
    if (isOwner) return reservation.is_solo ? SESSION_HOURS : SESSION_HOURS / 2;
    return SESSION_HOURS / 2;
}

function sumMemberHours(reservations, memberId, dateFrom, dateTo) {
    return reservations.reduce((total, r) => {
        if (r.date < dateFrom || r.date > dateTo) return total;
        return total + memberHoursInReservation(r, memberId);
    }, 0);
}

// Main App Component
function App() {
    // --- Identidad del socio -------------------------------------------------
    // `memberCode` es la credencial que se envía al servidor en cada operación.
    // `memberId` es lo que identifica al socio dentro de los datos (reservas,
    // acompañantes). No mezclar: antes se usaba el código para ambas cosas y
    // acababa guardado en `reservations`, donde cualquiera podía leerlo.
    const [memberCode, setMemberCode] = useState(() => sessionStorage.getItem('memberCode') || '');
    const [memberId, setMemberId] = useState(() => sessionStorage.getItem('memberId') || '');
    const [memberName, setMemberName] = useState(() => sessionStorage.getItem('memberName') || '');
    const [memberPhoto, setMemberPhoto] = useState(() => sessionStorage.getItem('memberPhoto') || '');
    const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');

    const [isPortalLocked, setIsPortalLocked] = useState(() => {
        return sessionStorage.getItem('accessGranted') !== 'true';
    });

    const {
        reservations,
        addReservation,
        deleteReservation,
        checkAvailability,
        joinReservation,
        error: reservationsError
    } = useReservations(memberCode);

    const {
        members,
        addMember,
        deleteMember,
        updateMemberPhoto,
        uploadMemberPhoto,
        loading: membersLoading,
        error: membersError
    } = useMembers(memberCode);

    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('servicios');

    const handleLogout = () => {
        setMemberName('');
        setMemberCode('');
        setMemberId('');
        setMemberPhoto('');
        setIsAdmin(false);
        setIsPortalLocked(true);
        sessionStorage.clear();
        setActiveTab('servicios');
    };

    // Mantiene el perfil en cabecera al día si un admin cambia tu nombre o foto
    // mientras estás dentro.
    useEffect(() => {
        if (!members.length || !memberId) return;

        const me = members.find(m => String(m.id) === String(memberId));
        if (!me) return;

        if (me.name !== memberName) {
            setMemberName(me.name);
            sessionStorage.setItem('memberName', me.name);
        }
        if ((me.photo_url || '') !== memberPhoto) {
            setMemberPhoto(me.photo_url || '');
            sessionStorage.setItem('memberPhoto', me.photo_url || '');
        }
        if ((me.is_admin || false) !== isAdmin) {
            setIsAdmin(me.is_admin || false);
            sessionStorage.setItem('isAdmin', me.is_admin ? 'true' : 'false');
        }
    }, [members, memberId, memberName, memberPhoto, isAdmin]);

    const handlePhotoUpdate = async (id, photoUrl) => {
        const result = await updateMemberPhoto(id, photoUrl);
        if (result.success && String(id) === String(memberId)) {
            const newPhoto = result.data.photo_url || '';
            setMemberPhoto(newPhoto);
            sessionStorage.setItem('memberPhoto', newPhoto);
        }
        return result;
    };

    const handlePhotoUpload = async (id, file) => {
        const result = await uploadMemberPhoto(id, file);
        if (result.success && String(id) === String(memberId)) {
            const newPhoto = result.data.photo_url || '';
            setMemberPhoto(newPhoto);
            sessionStorage.setItem('memberPhoto', newPhoto);
        }
        return result;
    };

    const [isLargeFont, setIsLargeFont] = useState(() => {
        const saved = localStorage.getItem('isLargeFont');
        return saved ? JSON.parse(saved) : false;
    });

    // Handle Font Scale
    useEffect(() => {
        const scale = isLargeFont ? 1.5 : 1;
        document.documentElement.style.setProperty('--font-scale', scale);
        localStorage.setItem('isLargeFont', JSON.stringify(isLargeFont));
    }, [isLargeFont]);

    // Cancelación desde el enlace del mensaje de confirmación.
    // El `ref` evita que el diálogo se repita: el efecto se re-ejecutaba en
    // cada render porque `deleteReservation` cambiaba de identidad.
    const cancelHandled = useRef(false);
    useEffect(() => {
        if (cancelHandled.current || !memberCode) return;

        const params = new URLSearchParams(window.location.search);
        const cancelId = params.get('cancel');
        if (!cancelId) return;

        cancelHandled.current = true;
        (async () => {
            if (window.confirm('¿Seguro que quieres cancelar tu reserva?')) {
                const res = await deleteReservation(cancelId);
                if (res.success) {
                    alert('Reserva cancelada con éxito.');
                } else {
                    alert('Error al cancelar: ' + res.error);
                }
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        })();
    }, [deleteReservation, memberCode]);

    const currentHour = new Date().getHours();
    const isOpen = currentHour >= 9 && currentHour < 21;

    // Static list of tables with specific names/colors from reference
    const tablesData = [
        { id: 1, name: 'Mesa 1 - Sagredo', colorClass: 'icon-blue' },
        { id: 2, name: 'Mesa 2 - Liern', colorClass: 'icon-red' },
        { id: 3, name: 'Mesa 3 - Bailen', colorClass: 'icon-green' },
        { id: 4, name: 'Mesa 4 - Escuela', colorClass: 'icon-gold' },
    ];

    const handleOpenReserve = (tableId) => {
        const table = tablesData.find(t => t.id === tableId);
        setSelectedTable(table);
        setIsWizardOpen(true);
    };

    const handleCloseWizard = () => {
        setIsWizardOpen(false);
        setSelectedTable(null);
    };

    const handleConfirmReservation = async (data) => {
        const result = await addReservation(
            data.tableId,
            data.date,
            data.time,
            data.isSolo,
            data.companionMemberId,
            data.category,
            data.gameMode,
            data.allowJoin
        );

        if (result.success) {
            alert('¡Reserva confirmada con éxito! 🎉');
            handleCloseWizard();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handleAccessGranted = (name, code, adminStatus, photoUrl, id) => {
        sessionStorage.setItem('accessGranted', 'true');
        sessionStorage.setItem('memberName', name);
        sessionStorage.setItem('memberCode', code);
        sessionStorage.setItem('isAdmin', adminStatus ? 'true' : 'false');
        sessionStorage.setItem('memberId', id || '');
        sessionStorage.setItem('memberPhoto', photoUrl || '');
        setMemberName(name);
        setMemberCode(code);
        setIsAdmin(adminStatus || false);
        setMemberId(id || '');
        setMemberPhoto(photoUrl || '');
        setIsPortalLocked(false);
    };

    const handleJoinReservation = async (reservationId) => {
        const result = await joinReservation(reservationId);

        if (result.success) {
            alert('¡Te has unido a la reserva con éxito! 🎉');
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const memberNumber = useMemo(() => {
        const index = members.findIndex(m => String(m.id) === String(memberId));
        return index >= 0 ? index + 1 : null;
    }, [members, memberId]);

    const myReservations = useMemo(() => reservations.filter(r =>
        String(r.member_id) === String(memberId) ||
        String(r.companion_member_id) === String(memberId)
    ), [reservations, memberId]);

    const hoursConsumption = useMemo(() => {
        const today = todayLocalISO();
        const { start, end } = weekRangeLocalISO(today);
        return {
            daily: sumMemberHours(reservations, memberId, today, today),
            weekly: sumMemberHours(reservations, memberId, start, end)
        };
    }, [reservations, memberId]);

    const loadError = reservationsError || membersError;

    return (
        <>
            {isPortalLocked && (
                <AccessPortal onAccessGranted={handleAccessGranted} />
            )}
            <div className="app-container">
                {/* Top Navigation */}
                <nav className="top-nav">
                    <div className="brand-name">Club de billar Paterna</div>
                    <div className="user-profile">
                        <div className="accessibility-controls">
                            <button
                                className={`font-control-btn single-btn ${isLargeFont ? 'active' : ''}`}
                                onClick={() => setIsLargeFont(!isLargeFont)}
                                title={isLargeFont ? "Tamaño de letra normal" : "Aumentar tamaño de letra"}
                            >
                                A
                            </button>
                        </div>
                        {memberName && (
                            <div className="admin-menu">
                                <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión" style={{ marginLeft: 0 }}>SALIR</button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Aviso de conexión: antes los errores solo iban a la consola,
                    así que si Supabase estaba caído la app se veía vacía sin
                    ninguna explicación. */}
                {loadError && (
                    <div className="connection-error-banner" role="alert">
                        ⚠️ {loadError} Comprueba tu conexión y vuelve a intentarlo.
                    </div>
                )}

                {/* Hero Section */}
                <div className="hero-section">
                    <div className="hero-content">
                        <div className="hero-icon">
                            <img
                                src={memberPhoto || '/club-logo.jpg'}
                                alt={memberName || 'Club de billar Paterna'}
                                className="hero-icon-img"
                                onError={() => memberPhoto && setMemberPhoto('')}
                            />
                        </div>
                        <div className="hero-details">
                            <h1>{memberName ? `Bienvenido ${memberName}` : 'Club de billar Paterna'}</h1>
                            <span className={`status-badge ${isOpen ? 'open' : 'closed'}`}>
                                {isOpen ? 'Local Abierto' : 'Local Cerrado'}
                            </span>
                            {memberName && (
                                <div className="hours-consumption">
                                    <HourConsumptionBar
                                        label="Consumo diario"
                                        hours={hoursConsumption.daily}
                                        limit={DAILY_HOUR_LIMIT}
                                    />
                                    <HourConsumptionBar
                                        label="Consumo semanal"
                                        hours={hoursConsumption.weekly}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Tabs */}
                <div className="tabs-nav">
                    <button
                        className={`tab-link ${activeTab === 'servicios' ? 'active' : ''}`}
                        onClick={() => setActiveTab('servicios')}
                    >
                        RESERVAR
                    </button>
                    {memberName && (
                        <button
                            className={`tab-link ${activeTab === 'mis-reservas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('mis-reservas')}
                        >
                            MIS RESERVAS
                        </button>
                    )}
                    <button
                        className={`tab-link ${activeTab === 'partidas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('partidas')}
                    >
                        PARTIDAS DE HOY
                    </button>
                    <button
                        className={`tab-link ${activeTab === 'info-uso' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info-uso')}
                    >
                        INFO DE USO
                    </button>
                    {isAdmin && (
                        <button
                            className={`tab-link ${activeTab === 'todas-reservas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('todas-reservas')}
                        >
                            TODAS LAS RESERVAS
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            className={`tab-link ${activeTab === 'socios' ? 'active' : ''}`}
                            onClick={() => setActiveTab('socios')}
                        >
                            SOCIOS
                        </button>
                    )}
                </div>

                <main>
                    {activeTab === 'servicios' && (
                        <>
                            <div className="section-header">
                                <h2 className="section-title">Servicios</h2>
                            </div>

                            <TableList tables={tablesData} onReserve={handleOpenReserve} />
                        </>
                    )}

                    {activeTab === 'partidas' && (
                        <DailyPartidas
                            reservations={reservations}
                            onJoinReservation={handleJoinReservation}
                            memberName={memberName}
                            memberId={memberId}
                        />
                    )}

                    {activeTab === 'info-uso' && <UsageInfo />}

                    {activeTab === 'mis-reservas' && memberName && (
                        <AdminCalendarView
                            reservations={myReservations}
                            onDelete={deleteReservation}
                            isAdmin={false}
                            currentMemberId={memberId}
                        />
                    )}

                    {activeTab === 'todas-reservas' && isAdmin && (
                        <AdminCalendarView
                            reservations={reservations}
                            onDelete={deleteReservation}
                            isAdmin={true}
                            currentMemberId={memberId}
                        />
                    )}

                    {activeTab === 'socios' && isAdmin && (
                        <MemberManager
                            members={members}
                            onAddMember={addMember}
                            onDeleteMember={deleteMember}
                            onUpdatePhoto={handlePhotoUpdate}
                            onUploadPhoto={handlePhotoUpload}
                            loading={membersLoading}
                        />
                    )}

                </main>

                <ReservationWizard
                    isOpen={isWizardOpen}
                    onClose={handleCloseWizard}
                    onSubmit={handleConfirmReservation}
                    tableData={selectedTable}
                    checkAvailability={checkAvailability}
                    isLargeFont={isLargeFont}
                    setIsLargeFont={setIsLargeFont}
                    memberName={memberName}
                    memberId={memberId}
                    memberNumber={memberNumber}
                    reservations={reservations}
                    members={members}
                    onJoinReservation={handleJoinReservation}
                />
            </div >
        </>
    );
}

// Sin `limit`, la barra no representa un tope: solo acumula visualmente las
// horas gastadas (escala de referencia fija, no un límite real).
const NO_LIMIT_SCALE = 7;

function HourConsumptionBar({ label, hours, limit }) {
    const hasLimit = limit != null;
    const percent = Math.min(100, (hours / (hasLimit ? limit : NO_LIMIT_SCALE)) * 100);
    // Formato h:mm (p. ej. 0:45, 1:30).
    const formatHours = (h) => {
        const totalMinutes = Math.round(h * 60);
        return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
    };

    return (
        <div className="hour-bar">
            <div className="hour-bar-label">
                <span>{label}</span>
                <span>{formatHours(hours)}h{hasLimit ? ` / ${formatHours(limit)}h` : ''}</span>
            </div>
            <div className="hour-bar-track">
                <div
                    className={`hour-bar-fill ${hasLimit && percent >= 100 ? 'full' : ''}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}

export default App;
