import './UsageInfo.css';

const RULES = [
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
