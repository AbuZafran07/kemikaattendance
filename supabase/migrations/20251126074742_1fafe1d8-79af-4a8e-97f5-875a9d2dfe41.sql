-- Migrate office_location to support multiple locations
-- First, get the current single office_location
DO $$
DECLARE
  current_location jsonb;
BEGIN
  -- Get current office_location value
  SELECT value INTO current_location 
  FROM system_settings 
  WHERE key = 'office_location';
  
  -- Update to array format with location name
  IF current_location IS NOT NULL THEN
    UPDATE system_settings
    SET value = jsonb_build_array(
      jsonb_build_object(
        'name', 'Kantor Pusat',
        'latitude', current_location->>'latitude',
        'longitude', current_location->>'longitude',
        'radius', current_location->>'radius'
      )
    ),
    key = 'office_locations',
    description = 'Office GPS coordinates and validation radius (supports multiple locations)'
    WHERE key = 'office_location';
  END IF;
END $$;