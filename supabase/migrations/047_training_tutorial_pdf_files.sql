ALTER TABLE training_tutorials
  ADD COLUMN IF NOT EXISTS pdf_files jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE training_tutorials
SET pdf_files = jsonb_build_array(
  jsonb_build_object(
    'name', COALESCE(source_name, title, 'Slides PDF'),
    'url', deck_pdf_url
  )
)
WHERE COALESCE(deck_pdf_url, '') <> ''
  AND (
    jsonb_typeof(pdf_files) IS DISTINCT FROM 'array'
    OR jsonb_array_length(pdf_files) = 0
  );
