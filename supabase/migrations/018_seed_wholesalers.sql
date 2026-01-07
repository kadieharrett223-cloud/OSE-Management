-- Seed default wholesalers with 10% commission (editable in UI)
-- Includes aliases noted in comments for clarity

INSERT INTO wholesalers (company_name, commission_percentage, notes)
SELECT 'Wholesale Lifts', 10.00, 'Alias: WS'
WHERE NOT EXISTS (SELECT 1 FROM wholesalers WHERE lower(company_name) = lower('Wholesale Lifts'));

INSERT INTO wholesalers (company_name, commission_percentage, notes)
SELECT 'Turbo Lifts', 10.00, 'Alias: TL'
WHERE NOT EXISTS (SELECT 1 FROM wholesalers WHERE lower(company_name) = lower('Turbo Lifts'));

INSERT INTO wholesalers (company_name, commission_percentage, notes)
SELECT 'Heavy Lift Direct', 10.00, 'Alias: HLD'
WHERE NOT EXISTS (SELECT 1 FROM wholesalers WHERE lower(company_name) = lower('Heavy Lift Direct'));

INSERT INTO wholesalers (company_name, commission_percentage, notes)
SELECT 'PSV', 10.00, NULL
WHERE NOT EXISTS (SELECT 1 FROM wholesalers WHERE lower(company_name) = lower('PSV'));

INSERT INTO wholesalers (company_name, commission_percentage, notes)
SELECT 'Northern Tool & Equipment', 10.00, 'Aliases: NT; Northern Tool'
WHERE NOT EXISTS (SELECT 1 FROM wholesalers WHERE lower(company_name) = lower('Northern Tool & Equipment'));
