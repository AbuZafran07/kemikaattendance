CREATE OR REPLACE FUNCTION public.list_backup_tables()
RETURNS TABLE(table_name text, pk_columns text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.relname::text,
    COALESCE((SELECT array_agg(a.attname::text ORDER BY array_position(i.indkey::int2[], a.attnum))
      FROM pg_catalog.pg_index i JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = c.oid AND i.indisprimary), ARRAY[]::text[])
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relispartition
  ORDER BY c.relname;
$$;
REVOKE ALL ON FUNCTION public.list_backup_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_backup_tables() TO service_role;