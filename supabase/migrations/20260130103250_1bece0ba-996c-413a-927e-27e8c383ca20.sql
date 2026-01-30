-- Fix joint_type for structural foils (butt joint)
UPDATE products 
SET joint_type = 'butt' 
WHERE foil_category = 'strukturalna';

-- Fix joint_type for standard foils (overlap)
UPDATE products 
SET joint_type = 'overlap' 
WHERE foil_category IN ('jednokolorowa', 'nadruk');