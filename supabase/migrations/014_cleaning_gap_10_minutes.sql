-- ============================================================================
-- Nuevo horario: 10 minutos de limpieza entre partidas
-- ============================================================================
-- Las partidas siguen durando 1:30, pero entre una y otra quedan 10 minutos
-- para limpiar las mesas (también antes de la primera de cada turno):
--
--   Mañanas   09:10–10:40   10:50–12:20   12:30–14:00
--   Tardes    16:10–17:40   17:50–19:20   19:30–21:00
--
-- Las reservas desde el lunes de esta semana se pasan a la hora nueva, para
-- que la regla de "una franja por semana" siga reconociéndolas.
-- ============================================================================

begin;

update reservations
set time = case time
  when '09:00' then '09:10'
  when '10:30' then '10:50'
  when '12:00' then '12:30'
  when '16:00' then '16:10'
  when '17:30' then '17:50'
  when '19:00' then '19:30'
end
where time in ('09:00', '10:30', '12:00', '16:00', '17:30', '19:00')
  and date::date >= date_trunc('week', (now() at time zone 'Europe/Madrid'))::date;

create or replace function public.create_reservation(
  p_code         text,
  p_table_id     int,
  p_date         date,
  p_time         text,
  p_is_solo      boolean,
  p_companion_id text default null,
  p_category     text default null,
  p_game_mode    text default null,
  p_allow_join   boolean default true
)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    members;
  v_companion members;
  v_row       reservations;
begin
  v_caller := public._require_member(p_code);

  if p_table_id is null or p_date is null or p_time is null then
    raise exception 'Faltan datos obligatorios';
  end if;

  if p_category is null or p_category not in ('principiante', 'avanzado', 'competitivo') then
    raise exception 'Debes indicar tu categoría: principiante, avanzado o competitivo';
  end if;

  if p_game_mode is null or p_game_mode not in ('libre', 'cuadro', 'tres_bandas', 'una_banda') then
    raise exception 'Debes indicar la modalidad de juego: tres bandas, libre, una banda o cuadro';
  end if;

  if p_time not in ('09:10', '10:50', '12:30', '16:10', '17:50', '19:30') then
    raise exception 'Franja horaria no válida';
  end if;

  if p_date < (now() at time zone 'Europe/Madrid')::date then
    raise exception 'No se pueden crear reservas en fechas pasadas';
  end if;

  -- Mañana se cierra a las 21:00; pasado mañana en adelante, a cualquier hora.
  if p_date = (now() at time zone 'Europe/Madrid')::date + 1
     and extract(hour from (now() at time zone 'Europe/Madrid')) >= 21 then
    raise exception 'Las reservas para el día siguiente se cierran a las 21:00';
  end if;

  if public._member_has_weekly_slot(v_caller.id::text, p_date, p_time) then
    raise exception 'Ya tienes una reserva a las % esta semana. Prueba otra hora o espera a la semana que viene.', p_time;
  end if;

  if p_is_solo then
    if public._member_daily_hours(v_caller.id::text, p_date) + 1.5 > 1.5 then
      raise exception 'Ya has alcanzado tu límite de 1:30 de mesa para ese día';
    end if;
  else
    if p_companion_id is null or p_companion_id = '' then
      raise exception 'Debes seleccionar un acompañante';
    end if;
    select * into v_companion from members m where m.id::text = p_companion_id;
    if v_companion.id is null then
      raise exception 'El acompañante seleccionado no existe';
    end if;
    if v_companion.id = v_caller.id then
      raise exception 'No puedes seleccionarte a ti mismo como acompañante';
    end if;

    if public._member_daily_hours(v_caller.id::text, p_date) + 0.75 > 1.5 then
      raise exception 'Ya has alcanzado tu límite de 1:30 de mesa para ese día';
    end if;
    if public._member_daily_hours(v_companion.id::text, p_date) + 0.75 > 1.5 then
      raise exception 'Tu acompañante ya ha alcanzado su límite de 1:30 de mesa para ese día';
    end if;
    if public._member_has_weekly_slot(v_companion.id::text, p_date, p_time) then
      raise exception 'Tu acompañante ya tiene una reserva a las % esta semana.', p_time;
    end if;
  end if;

  insert into reservations (
    table_id, date, time, customer_name, member_id,
    is_solo, companion_name, companion_member_id,
    category, game_mode, allow_join
  )
  values (
    p_table_id, p_date, p_time, v_caller.name, v_caller.id::text,
    p_is_solo,
    case when p_is_solo then null else v_companion.name end,
    case when p_is_solo then null else v_companion.id::text end,
    p_category, p_game_mode,
    -- En una reserva acompañada el permiso no significa nada: la plaza ya
    -- está ocupada. Se guarda false para que no confunda al leer la tabla.
    case when p_is_solo then coalesce(p_allow_join, true) else false end
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otro socio';
end;
$$;

commit;
