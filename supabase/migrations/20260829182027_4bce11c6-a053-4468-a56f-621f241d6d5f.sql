CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION private.increment_property_views(_slug TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.properties SET views = views + 1 WHERE slug = _slug AND approval = 'approved';
$$;
REVOKE ALL ON FUNCTION private.increment_property_views(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.increment_property_views(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_property_views(_slug TEXT)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.increment_property_views(_slug);
$$;
REVOKE ALL ON FUNCTION public.increment_property_views(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_property_views(TEXT) TO anon, authenticated, service_role;