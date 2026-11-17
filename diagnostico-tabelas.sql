-- =============================================================================
-- Script de Diagnóstico Simplificado — Barber-On Studio
-- Execute no Supabase Dashboard → SQL Editor
-- Cada linha retorna ✅ EXISTE ou ❌ FALTA
-- =============================================================================

SELECT 'organizations' AS tabela, CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN '✅ EXISTE' ELSE '❌ FALTA' END AS status
UNION ALL SELECT 'profiles', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'memberships', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='memberships') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'customers', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customers') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'leads', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='leads') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'products', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'product_categories', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_categories') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'orders', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'order_items', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='order_items') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'financial_accounts', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_accounts') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'financial_categories', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_categories') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'receivables', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receivables') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'payables', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payables') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'financial_payments', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_payments') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'payment_allocations', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_allocations') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'financial_transactions', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_transactions') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'role_permissions', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_permissions') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'audit_logs', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'tasks', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'calendar_events', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_events') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'notifications', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'barber_services', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='barber_services') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'service_categories', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='service_categories') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'barber_schedules', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='barber_schedules') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'barber_commissions', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='barber_commissions') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'commission_rules', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='commission_rules') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'public_bookings', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='public_bookings') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'booking_blocks', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='booking_blocks') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'barbershop_settings', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='barbershop_settings') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'subscription_plans', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscription_plans') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'subscriptions', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'loyalty_points', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='loyalty_points') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'whatsapp_templates', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_templates') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'whatsapp_messages', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_messages') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'recurring_appointments', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recurring_appointments') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'comandas', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='comandas') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'comanda_items', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='comanda_items') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'financial_closings', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_closings') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'automation_rules', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_rules') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'marketing_campaigns', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='marketing_campaigns') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'inventory_items', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_items') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'suppliers', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers') THEN '✅ EXISTE' ELSE '❌ FALTA' END
UNION ALL SELECT 'quotes', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quotes') THEN '✅ EXISTE' ELSE '❌ FALTA' END
ORDER BY tabela;

-- =============================================================================
-- Verificar vínculo do admin com a organização
-- =============================================================================
SELECT p.full_name, p.email, m.role, m.status, o.name AS organizacao
FROM memberships m
JOIN profiles p ON p.id = m.user_id
JOIN organizations o ON o.id = m.organization_id
WHERE o.id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
ORDER BY p.full_name;