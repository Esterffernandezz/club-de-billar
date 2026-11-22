-- ============================================================================
-- Tiempo real para la tabla de reservas
-- ============================================================================
-- El panel de la televisión (?panel) se suscribe a los cambios de
-- `reservations` para mostrar al instante las reservas nuevas o canceladas.
-- Supabase solo emite esos eventos para tablas incluidas en la publicación
-- `supabase_realtime`. Los eventos respetan las políticas RLS de lectura, que
-- ya permiten leer la tabla sin iniciar sesión.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
