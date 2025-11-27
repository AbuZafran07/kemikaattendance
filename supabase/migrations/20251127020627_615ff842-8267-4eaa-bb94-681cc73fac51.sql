-- Ensure ferry@kemika.co.id has admin role
DO $$ 
DECLARE
  ferry_user_id uuid;
BEGIN
  -- Get the user ID for ferry@kemika.co.id
  SELECT id INTO ferry_user_id 
  FROM profiles 
  WHERE email = 'ferry@kemika.co.id';
  
  IF ferry_user_id IS NOT NULL THEN
    -- Delete any existing role for this user
    DELETE FROM user_roles WHERE user_id = ferry_user_id;
    
    -- Insert admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (ferry_user_id, 'admin');
  END IF;
END $$;