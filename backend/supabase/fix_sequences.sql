select setval(pg_get_serial_sequence('public.users', 'id'), coalesce(max(id), 1)) from public.users;
select setval(pg_get_serial_sequence('public.vendedores', 'id'), coalesce(max(id), 1)) from public.vendedores;
select setval(pg_get_serial_sequence('public.clientes', 'id'), coalesce(max(id), 1)) from public.clientes;
select setval(pg_get_serial_sequence('public.produtos', 'id'), coalesce(max(id), 1)) from public.produtos;
select setval(pg_get_serial_sequence('public.pedidos', 'id'), coalesce(max(id), 1)) from public.pedidos;
select setval(pg_get_serial_sequence('public.pedido_itens', 'id'), coalesce(max(id), 1)) from public.pedido_itens;
