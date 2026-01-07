-- Create reps for each wholesaler so QBO invoices with wholesaler sales reps can be matched
-- These reps will be excluded from commissioned tab and only show on wholesalers tab

INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
SELECT 'Wholesale Lifts', 'WS', 0.10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM reps WHERE lower(rep_name) = lower('Wholesale Lifts'));

INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
SELECT 'Turbo Lifts', 'TL', 0.10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM reps WHERE lower(rep_name) = lower('Turbo Lifts'));

INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
SELECT 'Heavy Lift Direct', 'HLD', 0.10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM reps WHERE lower(rep_name) = lower('Heavy Lift Direct'));

INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
SELECT 'PSV', 'PSV', 0.10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM reps WHERE lower(rep_name) = lower('PSV'));

INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
SELECT 'Northern Tool & Equipment', 'NT', 0.10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM reps WHERE lower(rep_name) = lower('Northern Tool & Equipment'));
