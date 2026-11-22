import './UsageInfo.css';

const RULES = [
    {
        title: 'Horario',
        text: 'Mañanas: 9:10–10:40, 10:50–12:20 y 12:30–14:00. Tardes: 16:10–17:40, 17:50–19:20 y 19:30–21:00. Entre partida y partida hay 10 minutos para limpiar las mesas. Las reservas para el día siguiente se pueden hacer hasta las 21:00; para los demás días se puede reservar a cualquier hora.',
    },
    {
        title: 'Límite diario',
        text: 'Cada sesión dura 1 h 30 min. Máximo una sesión (1:30) de juego al día por socio.',
    },
    {
        title: 'Una franja por semana',
        text: 'No se puede repetir la misma franja horaria en la misma semana, ni como titular ni como acompañante.',
    },
    {
        title: 'Reserva individual o acompañada',
        text: 'Si juegas solo, otro socio puede unirse a tu partida. Si vas acompañado, la mesa queda cerrada para esa franja.',
    },
    {
        title: 'Cancelación',
        text: 'Cancela con al menos 2 horas de antelación para liberar la mesa a otros socios.',
    },
    {
        title: 'Puntualidad',
        text: 'Si no te presentas pasados 15 minutos desde la hora reservada, la mesa quedará libre para otros socios.',
    },
    {
        title: 'Acceso',
        text: 'El uso de las mesas es exclusivo para socios con código de acceso activo.',
    },
    {
        title: 'Cuidado del material',
        text: 'Cuida el material del club (tacos, bolas, mesa) y déjalo en buen estado para el siguiente socio.',
    },
];

export const UsageInfo = () => {
    return (
        <div className="usage-info-container">
            <div className="section-header">
                <h2 className="section-title">Información de uso</h2>
            </div>

            <ul className="usage-info-list">
                {RULES.map((rule, index) => (
                    <li key={rule.title} className="usage-info-item">
                        <span className="usage-info-number">{index + 1}</span>
                        <div className="usage-info-text">
                            <h3>{rule.title}</h3>
                            <p>{rule.text}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
