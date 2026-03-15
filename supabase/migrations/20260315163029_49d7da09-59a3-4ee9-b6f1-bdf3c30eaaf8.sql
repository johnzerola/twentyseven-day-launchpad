INSERT INTO public.scene_prompt_knowledge (category, title, prompt_template, viral_score, tags)
VALUES
('dopamine-hook', 'Scroll-Stop Nuclear Hook (0-3s)', 
 'extreme close-up of character''s eyes widening in shock, rack focus from blurred background to sharp face, single dramatic light source from screen glow, shallow DOF f/1.2, camera snapping zoom in 0.5s, vertical 9:16, emotional intensity maximum (do not include any platform logos, watermarks, text, or signatures)', 
 98, '["hook","dopamine","scroll-stop","0-3s"]'::jsonb),

('dopamine-hook', 'Aerial Reveal Hook (0-3s)',
 'aerial drone rapidly descending from cloud level toward subject standing on rooftop edge, golden hour light, lens flare, scale revelation, vertigo-inducing camera move, vertical 9:16 composition (do not include any platform logos, watermarks, text, or signatures)',
 97, '["hook","aerial","reveal","0-3s"]'::jsonb),

('dopamine-hook', 'Mystery Object Hook (0-3s)',
 'extreme macro close-up of mysterious object slowly being revealed by hand pulling cloth away, single spotlight, dust particles floating in beam, shallow DOF, suspenseful composition, vertical 9:16 (do not include any platform logos, watermarks, text, or signatures)',
 96, '["hook","mystery","macro","0-3s"]'::jsonb),

('master-block', 'Wojak Emotional Sequence',
 '0-3s: wide cinematic shot of yellow wojak character in dramatic environment, morning light through window, camera slowly dollying in | 3-5s: extreme close-up of worried face illuminated by phone screen glow, shallow DOF | 5-8s: rooftop panoramic establishing shot, dense urban skyline at sunrise, camera slowly pulling away revealing scale (do not include any platform logos, watermarks, text, or signatures)',
 95, '["wojak","master-block","emotional","sequence"]'::jsonb),

('master-block', 'Dark Noir Tension Sequence',
 '0-3s: slow reveal through absolute darkness, single neon light source cracking through door gap, smoke wisps | 3-5s: extreme close-up of eye reflecting danger, Blade Runner 2049 palette, blue-orange contrast | 5-8s: wide shot of oppressive environment, crushed blacks, rain streaks, silhouette centered, dutch angle (do not include any platform logos, watermarks, text, or signatures)',
 94, '["dark","noir","tension","master-block"]'::jsonb),

('master-block', 'Cinematic Story Escalation',
 '0-3s: dramatic flashforward to climax moment, fire/explosion/revelation, ARRI ALEXA 65 look, anamorphic lens flare | 3-8s: rewind transition to calm establishing shot, contrast with opening intensity | 8-12s: tracking shot building tension, Steadicam through environment, volumetric rays | 12-15s: emotional payoff close-up, loop-ready composition matching opening color (do not include any platform logos, watermarks, text, or signatures)',
 93, '["cinematic","story","escalation","master-block"]'::jsonb),

('dopamine-technique', 'Pattern Interrupt Every 8s',
 'At exactly 8-second intervals inject a completely unexpected visual: sudden angle change (low angle to bird eye), lighting shift (warm to cold), or scale change (macro to wide). This triggers dopamine release through novelty detection.',
 92, '["technique","pattern-interrupt","8s","dopamine"]'::jsonb),

('dopamine-technique', 'Loop Magnet Final Scene',
 'Final 2-3 seconds must visually and emotionally mirror scene 1 but with TRANSFORMED context. Same camera angle, same lighting color, but subject has changed. Creates irresistible desire to rewatch.',
 91, '["technique","loop","magnet","final-scene"]'::jsonb),

('dopamine-technique', 'Emotional Whiplash Cut',
 'Adjacent scenes must have CONTRASTING emotions: joy to shock, calm to chaos, intimate to epic. The brain releases dopamine at emotional boundaries. Never place two scenes with the same mood next to each other.',
 90, '["technique","emotional-whiplash","contrast","cut"]'::jsonb),

('anti-text', 'Clean Output Suffix Standard',
 '(do not include any platform logos, watermarks, text, or signatures in the image; render clean final output, no UI overlays, no subtitles, no captions, no titles, no branding)',
 85, '["anti-text","suffix","clean","standard"]'::jsonb)

ON CONFLICT DO NOTHING;