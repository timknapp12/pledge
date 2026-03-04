-- Add French as a supported language
INSERT INTO supported_languages (code, label, sort_order) VALUES ('fr', 'Français', 2);

-- === DAILY REMINDER — CARROT / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'carrot', 'fr', 'Tu peux le faire !', 'C''est le moment de bosser sur "{{pledge_name}}" aujourd''hui !'),
  ('daily_reminder', 'carrot', 'fr', 'Continue sur ta lancée !', 'Un jour de plus, un pas de plus vers "{{pledge_name}}" !'),
  ('daily_reminder', 'carrot', 'fr', 'Crois en toi !', 'Les petites victoires s''additionnent — travaille sur "{{pledge_name}}" !'),
  ('daily_reminder', 'carrot', 'fr', 'Ton futur toi te remerciera', '"{{pledge_name}}" t''attend. Tu gères !'),
  ('daily_reminder', 'carrot', 'fr', 'Pas à pas', 'Le progrès bat la perfection. C''est l''heure de "{{pledge_name}}" !');

-- === DAILY REMINDER — STICK / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'stick', 'fr', 'Pas d''excuses', '"{{pledge_name}}" ne va pas se faire tout seul. Au boulot.'),
  ('daily_reminder', 'stick', 'fr', 'Tes tokens sont en jeu', 'Sécher "{{pledge_name}}" aujourd''hui, c''est jeter ton argent.'),
  ('daily_reminder', 'stick', 'fr', 'Arrête de procrastiner', '"{{pledge_name}}" t''attend. Lâche ton téléphone et bosse.'),
  ('daily_reminder', 'stick', 'fr', 'Le temps presse', 'Chaque jour où tu glandes sur "{{pledge_name}}" te coûte. Bouge.'),
  ('daily_reminder', 'stick', 'fr', 'Les lâcheurs perdent', '"{{pledge_name}}" — tu le fais ou tu perds ta mise ?');

-- === DEADLINE APPROACHING — CARROT / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'carrot', 'fr', 'Presque fini !', '"{{pledge_name}}" expire dans {{hours}} heure(s). Tu peux y arriver !'),
  ('deadline_approaching', 'carrot', 'fr', 'Dernière ligne droite !', 'Plus que {{hours}} heure(s) pour "{{pledge_name}}". Continue !'),
  ('deadline_approaching', 'carrot', 'fr', 'Tu y es presque !', 'La deadline de "{{pledge_name}}" est dans {{hours}} heure(s). Finis en beauté !');

-- === DEADLINE APPROACHING — STICK / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'stick', 'fr', 'Le temps est presque écoulé', '"{{pledge_name}}" expire dans {{hours}} heure(s). Ne gâche pas tout.'),
  ('deadline_approaching', 'stick', 'fr', 'Dernière chance', '{{hours}} heure(s) avant la deadline de "{{pledge_name}}". Arrête de repousser.'),
  ('deadline_approaching', 'stick', 'fr', 'Deadline imminente', '"{{pledge_name}}" dans {{hours}} heure(s). Échoue maintenant et perds ta mise.');
