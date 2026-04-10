-- =============================================
-- Seed claim_reminder notification templates
-- Used by the crank to remind users who completed 100%
-- but haven't claimed their tokens yet.
-- 2 variants × 2 personalities × 3 languages = 12 rows
-- =============================================

-- === CLAIM REMINDER — CARROT / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'carrot', 'en', 'You did it!', 'You completed "{{pledge_name}}" — remember to claim your tokens!'),
  ('claim_reminder', 'carrot', 'en', 'Don''t forget your reward!', '"{{pledge_name}}" is 100% done. Your tokens are waiting for you!');

-- === CLAIM REMINDER — STICK / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'stick', 'en', 'Claim your tokens already', 'You finished "{{pledge_name}}" but never claimed. Don''t be lame and leave money on the table.'),
  ('claim_reminder', 'stick', 'en', 'Unclaimed pledge alert', '"{{pledge_name}}" is done but your tokens are still locked. Claim them before you become a loser and lose them!');

-- === CLAIM REMINDER — CARROT / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'carrot', 'es', '¡Lo lograste!', 'Completaste "{{pledge_name}}" — ¡recuerda reclamar tus tokens!'),
  ('claim_reminder', 'carrot', 'es', '¡No olvides tu recompensa!', '"{{pledge_name}}" está 100% completado. ¡Tus tokens te esperan!');

-- === CLAIM REMINDER — STICK / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'stick', 'es', 'Reclama tus tokens ya', 'Terminaste "{{pledge_name}}" pero no reclamaste. No seas cobarde y dejes dinero sobre la mesa.'),
  ('claim_reminder', 'stick', 'es', 'Alerta: pledge sin reclamar', '"{{pledge_name}}" está hecho pero tus tokens siguen bloqueados. ¡Reclámalos antes de que te conviertas en un perdedor y los pierdas!');

-- === CLAIM REMINDER — CARROT / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'carrot', 'fr', 'Tu as réussi !', 'Tu as terminé "{{pledge_name}}" — n''oublie pas de récupérer tes tokens !'),
  ('claim_reminder', 'carrot', 'fr', 'N''oublie pas ta récompense !', '"{{pledge_name}}" est terminé à 100%. Tes tokens t''attendent !');

-- === CLAIM REMINDER — STICK / FR ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('claim_reminder', 'stick', 'fr', 'Récupère tes tokens', 'Tu as fini "{{pledge_name}}" mais tu n''as pas réclamé. Ne sois pas nul et ne laisse pas ton argent traîner.'),
  ('claim_reminder', 'stick', 'fr', 'Pledge non réclamé', '"{{pledge_name}}" est terminé mais tes tokens sont toujours bloqués. Récupère-les avant de devenir un loser et de les perdre !');
