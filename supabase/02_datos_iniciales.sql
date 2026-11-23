-- =====================================================================
--  MIS GASTOS – Datos iniciales (tus datos reales)
--  Se ejecuta UNA sola vez, DESPUÉS de 01_base_de_datos.sql
-- =====================================================================

-- Categorías (con palabras que reconoce la voz)
insert into finanzas.categorias (nombre, tipo, limite_mensual, palabras_clave) values
  ('Sueldo',              'Ingreso', null,   '{sueldo,salario}'),
  ('Aguinaldo',           'Ingreso', null,   '{aguinaldo}'),
  ('Proyectos',           'Ingreso', null,   '{proyecto,obra,cobré,cobre,honorario,honorarios,trabajo,me pagaron,cliente}'),
  ('Préstamos y cuotas',  'Gasto',   null,   '{préstamo,prestamo,cuota,atlas,tupí,tupi,japonesa,financiera}'),
  ('Tarjeta de crédito',  'Gasto',   null,   '{tarjeta,extracto}'),
  ('Facultad',            'Gasto',   null,   '{facultad,facu,fotocopia,fotocopias,libro,libros,impresión,impresion,materiales,upap}'),
  ('Cooperativa',         'Gasto',   null,   '{cooperativa,coomecipar,socio}'),
  ('Comida',              'Gasto',   null,   '{comida,almuerzo,cena,desayuno,merienda,súper,super,supermercado,delivery,empanada,empanadas,mercado,verdura,verduras,frutas,despensa}'),
  ('Transporte',          'Gasto',   null,   '{pasaje,pasajes,colectivo,bus,ómnibus,omnibus,uber,bolt,taxi,peaje,estacionamiento}'),
  ('Combustible',         'Gasto',   600000, '{combustible,nafta,gasolina,diesel,diésel,cargué,cargue nafta,surtidor,estación,estacion,shell,petrobras,copetrol,puma}'),
  ('Cuidado personal',    'Gasto',   null,   '{pelu,peluquería,peluqueria,uñas,farmacia,crema,perfume,cosméticos,cosmeticos}'),
  ('Celular y servicios', 'Gasto',   null,   '{celular,plan,saldo,internet,luz,ande,agua,essap,servicio,servicios,tigo,personal,claro}'),
  ('Salidas',             'Gasto',   null,   '{salida,salidas,cine,bar,cumple,cumpleaños,regalo,boliche,restaurante}'),
  ('Otros',               'Gasto',   null,   '{}');

-- Sueldo y gastos fijos (para la proyección)
insert into finanzas.configuracion (clave, valor) values ('sueldo', 3500000);

insert into finanzas.gastos_fijos (nombre, monto) values
  ('Facultad',               460000),
  ('Coomecipar (socio)',      92000),
  ('Peluquería',             200000),
  ('Plan celular',            80000),
  ('Combustible (tarjeta)',  600000);

-- Ingresos extra ya conocidos
insert into finanzas.extras_previstos (mes, detalle, monto) values
  ('2026-12-01', 'Proyectos diciembre (300.000 + 600.000)', 900000),
  ('2026-12-01', 'Aguinaldo',                               1500000),
  ('2027-01-01', 'Proyecto extra',                          600000);

-- Deudas
insert into finanzas.deudas (id, entidad, categoria, total_cuotas, notas) values
  (1, 'Itaú (préstamo)',       'Préstamos y cuotas', 36, 'Cuota variable: baja hasta la 21 y vuelve a subir. Consultar.'),
  (2, 'Paraguayo Japonesa',    'Préstamos y cuotas', 24, 'Financiera. Cuota que baja cada mes.'),
  (3, 'Atlas',                 'Préstamos y cuotas', 24, null),
  (4, 'Tupí (81.000)',         'Préstamos y cuotas', 15, null),
  (5, 'Tupí (514.000)',        'Préstamos y cuotas', 15, null),
  (6, 'Itaú (tarjeta, 6 cuotas)', 'Tarjeta de crédito', 6, 'Compra en cuotas dentro de la tarjeta');
select setval('finanzas.deudas_id_seq', 6);

-- Cronogramas reales (Itaú y Paraguayo Japonesa, según la app de cada uno)
insert into finanzas.cuotas (deuda_id, numero, vencimiento, monto, pagada) values
  (1, 1, '2026-10-05', 705747, true),
  (1, 2, '2026-11-05', 708415, true),
  (1, 3, '2026-12-05', 706652, false),
  (1, 4, '2027-01-05', 686516, false),
  (1, 5, '2027-02-05', 671565, false),
  (1, 6, '2027-03-05', 655361, false),
  (1, 7, '2027-04-05', 644179, false),
  (1, 8, '2027-05-05', 629970, false),
  (1, 9, '2027-06-05', 617590, false),
  (1, 10, '2027-07-05', 604284, false),
  (1, 11, '2027-08-05', 592649, false),
  (1, 12, '2027-09-05', 580622, false),
  (1, 13, '2027-10-05', 568677, false),
  (1, 14, '2027-11-05', 558142, false),
  (1, 15, '2027-12-05', 547099, false),
  (1, 16, '2028-01-05', 537279, false),
  (1, 17, '2028-02-05', 527310, false),
  (1, 18, '2028-03-05', 517482, false),
  (1, 19, '2028-04-05', 509136, false),
  (1, 20, '2028-05-05', 500323, false),
  (1, 21, '2028-06-05', 492279, false),
  (1, 22, '2028-07-05', 503208, false),
  (1, 23, '2028-08-05', 507814, false),
  (1, 24, '2028-09-05', 518208, false),
  (1, 25, '2028-10-05', 533499, false),
  (1, 26, '2028-11-05', 539735, false),
  (1, 27, '2028-12-05', 554758, false),
  (1, 28, '2029-01-05', 562138, false),
  (1, 29, '2029-02-05', 573644, false),
  (1, 30, '2029-03-05', 593963, false),
  (1, 31, '2029-04-05', 597543, false),
  (1, 32, '2029-05-05', 611846, false),
  (1, 33, '2029-06-05', 622297, false),
  (1, 34, '2029-07-05', 636292, false),
  (1, 35, '2029-08-05', 648059, false),
  (1, 36, '2029-09-05', 620443, false),
  (2, 1, '2026-12-01', 262726, false),
  (2, 2, '2027-01-01', 262583, false),
  (2, 3, '2027-02-01', 258798, false),
  (2, 4, '2027-03-01', 254518, false),
  (2, 5, '2027-04-01', 251068, false),
  (2, 6, '2027-05-01', 246984, false),
  (2, 7, '2027-06-01', 241614, false),
  (2, 8, '2027-07-01', 237399, false),
  (2, 9, '2027-08-02', 233284, false),
  (2, 10, '2027-09-01', 227358, false),
  (2, 11, '2027-10-01', 222164, false),
  (2, 12, '2027-11-01', 217159, false),
  (2, 13, '2027-12-01', 211006, false),
  (2, 14, '2028-01-03', 206375, false),
  (2, 15, '2028-02-01', 198266, false),
  (2, 16, '2028-03-01', 192120, false),
  (2, 17, '2028-04-03', 187133, false),
  (2, 18, '2028-05-01', 178190, false),
  (2, 19, '2028-06-01', 172331, false),
  (2, 20, '2028-07-03', 164995, false),
  (2, 21, '2028-08-01', 156453, false),
  (2, 22, '2028-09-01', 148959, false),
  (2, 23, '2028-10-02', 140501, false),
  (2, 24, '2028-11-01', 131812, false);

-- Cronogramas de cuota fija (Atlas, Tupí y tarjeta)
insert into finanzas.cuotas (deuda_id, numero, vencimiento, monto, pagada)
select 3, n, (date '2026-11-01' + (n-1) * interval '1 month')::date, 190000, n < 2 from generate_series(1,24) n;
insert into finanzas.cuotas (deuda_id, numero, vencimiento, monto, pagada)
select 4, n, (date '2026-11-01' + (n-1) * interval '1 month')::date,  81000, n < 2 from generate_series(1,15) n;
insert into finanzas.cuotas (deuda_id, numero, vencimiento, monto, pagada)
select 5, n, (date '2026-12-01' + (n-1) * interval '1 month')::date, 514000, false from generate_series(1,15) n;
insert into finanzas.cuotas (deuda_id, numero, vencimiento, monto, pagada)
select 6, n, (date '2026-10-01' + (n-1) * interval '1 month')::date, 290000, n < 3 from generate_series(1,6) n;

-- Movimientos de diciembre ya conocidos (los que no son cuotas de préstamo:
-- esas las anotás con el botón "Pagar cuota" de la app)
insert into finanzas.movimientos (fecha, descripcion, monto, tipo, categoria) values
  ('2026-12-01', 'Sueldo diciembre',               3500000, 'Ingreso', 'Sueldo'),
  ('2026-12-01', 'Aguinaldo',                      1500000, 'Ingreso', 'Aguinaldo'),
  ('2026-12-01', 'Proyecto (poner nombre)',         300000, 'Ingreso', 'Proyectos'),
  ('2026-12-01', 'Proyecto extra (hasta enero)',    600000, 'Ingreso', 'Proyectos'),
  ('2026-12-01', 'Combustible (con tarjeta Itaú)',  520200, 'Gasto',   'Combustible'),
  ('2026-12-01', 'Cuota facultad',                  460000, 'Gasto',   'Facultad'),
  ('2026-12-01', 'Coomecipar – cuota de socio',      92000, 'Gasto',   'Cooperativa'),
  ('2026-12-01', 'Peluquería',                      200000, 'Gasto',   'Cuidado personal'),
  ('2026-12-01', 'Plan celular',                     80000, 'Gasto',   'Celular y servicios');
