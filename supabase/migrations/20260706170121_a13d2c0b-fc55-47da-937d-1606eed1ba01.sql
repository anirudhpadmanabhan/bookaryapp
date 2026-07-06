ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE TRIGGER set_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.librarian_set_availability(_book_id uuid, _availability text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b_lib uuid;
BEGIN
  IF _availability NOT IN ('available','out_of_stock','rented') THEN
    RAISE EXCEPTION 'Invalid availability';
  END IF;

  SELECT library_id INTO b_lib FROM public.books WHERE id = _book_id;
  IF b_lib IS NULL AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized for this book';
  END IF;

  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role_in_library(auth.uid(),'librarian'::app_role, b_lib)
    OR (b_lib IS NULL AND public.has_role(auth.uid(),'librarian'::app_role))
  ) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;

  UPDATE public.books
     SET availability = _availability,
         updated_at = now()
   WHERE id = _book_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;