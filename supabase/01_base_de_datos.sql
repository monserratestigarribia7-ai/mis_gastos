-- =====================================================================
--  MIS GASTOS – Base de datos (módulo FINANZAS)
--  Se ejecuta UNA sola vez en Supabase > SQL Editor.
--  Crea el esquema "finanzas", sus tablas, vistas y permisos.
-- =====================================================================

-- 1) ESQUEMA ----------------------------------------------------------
create schema if not exists finanzas;

-- 2) TABLAS -----------------------------------------------------------

-- Categorías de ingresos y gastos (con límite mensual opcional)
create table if not exists finanzas.categorias (
  id              serial primary key,
  nombre          text not null unique,
  tipo            text not null check (tipo in ('Ingreso','Gasto')),
  limite_mensual  numeric(14,0),               -- tope por mes (null = sin tope)
  palabras_clave  text[] default '{}'          -- palabras que la voz reconoce
);

-- Cada gasto o ingreso que cargás
create table if not exists finanzas.movimientos (
  id           bigserial primary key,
  fecha        date not null default current_date,
  descripcion  text not null,
  monto        numeric(14,0) not null check (monto > 0),
  tipo         text not null check (tipo in ('Ingreso','Gasto')),
  categoria    text not null references finanzas.categorias(nombre) on update cascade,
  pagado       boolean not null default false,
  creado       timestamptz not null default now()
);
create index if not exists movimientos_fecha_idx on finanzas.movimientos (fecha);

-- Préstamos y compras en cuotas
create table if not exists finanzas.deudas (
  id            serial primary key,
  entidad       text not null,
  categoria     text not null references finanzas.categorias(nombre) on update cascade,
  total_cuotas  int  not null,
  notas         text
);

-- Cronograma: una fila por cada cuota de cada deuda
create table if not exists finanzas.cuotas (
  id           bigserial primary key,
  deuda_id     int  not null references finanzas.deudas(id) on delete cascade,
  numero       int  not null,
  vencimiento  date not null,
  monto        numeric(14,0) not null,
  pagada       boolean not null default false,
  unique (deuda_id, numero)
);

-- Datos fijos para la proyección: sueldo y gastos fijos del mes
create table if not exists finanzas.gastos_fijos (
  id      serial primary key,
  nombre  text not null,
  monto   numeric(14,0) not null
);

create table if not exists finanzas.configuracion (
  clave  text primary key,
  valor  numeric(14,0) not null
);

-- Ingresos extra que ya sabés que vas a tener (proyectos, aguinaldo)
create table if not exists finanzas.extras_previstos (
  id       serial primary key,
  mes      date not null,        -- siempre el día 1 del mes
  detalle  text not null,
  monto    numeric(14,0) not null
);

-- 3) VISTAS (consultas guardadas) ---------------------------------------

-- Estado de cada deuda
create or replace view finanzas.v_deudas as
select d.id,
       d.entidad,
       d.categoria,
       d.total_cuotas,
       d.notas,
       count(*) filter (where c.pagada)                         as cuotas_pagadas,
       count(*) filter (where not c.pagada)                     as cuotas_pendientes,
       coalesce(sum(c.monto) filter (where not c.pagada), 0)    as saldo_pendiente,
       min(c.vencimiento) filter (where not c.pagada)           as proximo_vencimiento,
       (array_agg(c.monto  order by c.numero) filter (where not c.pagada))[1] as proxima_cuota,
       (array_agg(c.numero order by c.numero) filter (where not c.pagada))[1] as proxima_cuota_numero,
       (array_agg(c.id     order by c.numero) filter (where not c.pagada))[1] as proxima_cuota_id,
       max(c.vencimiento)                                       as ultima_cuota
from finanzas.deudas d
join finanzas.cuotas c on c.deuda_id = d.id
group by d.id
order by ultima_cuota;

-- Proyección mes a mes: cuánto te queda
create or replace view finanzas.v_plan_mensual as
with meses as (
  select generate_series(date_trunc('month', current_date),
                         (select date_trunc('month', max(vencimiento)) from finanzas.cuotas),
                         interval '1 month')::date as mes
)
select m.mes,
       coalesce((select valor from finanzas.configuracion where clave = 'sueldo'), 0)        as sueldo,
       coalesce((select sum(monto) from finanzas.extras_previstos e where e.mes = m.mes), 0)  as extras,
       coalesce((select sum(monto) from finanzas.gastos_fijos), 0)                            as gastos_fijos,
       coalesce((select sum(monto) from finanzas.cuotas c
                  where date_trunc('month', c.vencimiento) = m.mes), 0)                       as cuotas,
         coalesce((select valor from finanzas.configuracion where clave = 'sueldo'), 0)
       + coalesce((select sum(monto) from finanzas.extras_previstos e where e.mes = m.mes), 0)
       - coalesce((select sum(monto) from finanzas.gastos_fijos), 0)
       - coalesce((select sum(monto) from finanzas.cuotas c
                    where date_trunc('month', c.vencimiento) = m.mes), 0)                     as queda
from meses m
order by m.mes;

-- 4) FUNCIÓN: pagar una cuota ------------------------------------------
-- Marca la cuota como pagada y la anota como gasto en movimientos.
create or replace function finanzas.pagar_cuota(p_cuota_id bigint)
returns void
language plpgsql
security invoker
as $$
declare
  v record;
begin
  select c.*, d.entidad, d.categoria, d.total_cuotas
    into v
    from finanzas.cuotas c join finanzas.deudas d on d.id = c.deuda_id
   where c.id = p_cuota_id and not c.pagada;
  if not found then
    raise exception 'La cuota no existe o ya está pagada';
  end if;

  update finanzas.cuotas set pagada = true where id = p_cuota_id;

  insert into finanzas.movimientos (fecha, descripcion, monto, tipo, categoria, pagado)
  values (current_date,
          v.entidad || ' – cuota ' || v.numero || '/' || v.total_cuotas,
          v.monto, 'Gasto', v.categoria, true);
end;
$$;

-- 5) PERMISOS Y SEGURIDAD ---------------------------------------------
-- Solo un usuario que inició sesión (vos) puede leer y escribir.
grant usage on schema finanzas to authenticated;
grant all on all tables    in schema finanzas to authenticated;
grant all on all sequences in schema finanzas to authenticated;
grant execute on all functions in schema finanzas to authenticated;

alter table finanzas.categorias       enable row level security;
alter table finanzas.movimientos      enable row level security;
alter table finanzas.deudas           enable row level security;
alter table finanzas.cuotas           enable row level security;
alter table finanzas.gastos_fijos     enable row level security;
alter table finanzas.configuracion    enable row level security;
alter table finanzas.extras_previstos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categorias','movimientos','deudas','cuotas',
                           'gastos_fijos','configuracion','extras_previstos']
  loop
    execute format('drop policy if exists solo_usuario on finanzas.%I', t);
    execute format('create policy solo_usuario on finanzas.%I
                      for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Las vistas respetan los permisos de quien consulta
alter view finanzas.v_deudas       set (security_invoker = on);
alter view finanzas.v_plan_mensual set (security_invoker = on);
