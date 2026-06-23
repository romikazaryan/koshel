-- Edge Functions (service_role) должны писать токены T-Invest.
grant all on table public.financial_connection_secrets to service_role;
