GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.increment_property_views(TEXT) TO anon, authenticated, service_role;