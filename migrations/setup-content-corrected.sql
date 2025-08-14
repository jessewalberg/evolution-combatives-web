-- Evolution Combatives - Categories Setup SQL (Corrected for Actual Schema)
-- Populates categories for existing disciplines in tactical training platform
-- Based on actual database structure: id, discipline_id, name, description, sort_order, created_at

-- ============================================================================
-- CATEGORIES FOR EXISTING DISCIPLINES
-- ============================================================================

-- Insert categories for Law Enforcement (ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8)
INSERT INTO categories (discipline_id, name, description, sort_order) VALUES 
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Basic Defensive Tactics', 'Fundamental defensive techniques every officer should know', 1),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Handcuffing & Control', 'Proper handcuffing techniques and suspect control methods', 2),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Report Writing', 'Essential report writing skills and documentation procedures', 3),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Advanced Defensive Tactics', 'Advanced techniques for high-risk encounters and tactical situations', 4),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'De-escalation Techniques', 'Verbal and non-verbal de-escalation strategies for crisis situations', 5),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Arrest Procedures', 'Safe and effective arrest techniques and detention procedures', 6),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Weapon Retention', 'Techniques to retain your firearm and prevent weapon grabs', 7),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Crowd Control', 'Mass event management and crowd control strategies', 8),
    ('ca2b5de3-4ab5-4ca6-9ba4-a80a86d2f5e8', 'Vehicle Extractions', 'Safe techniques for removing suspects from vehicles', 9);

-- Insert categories for Jiu Jitsu (c0aa8e50-9013-40b9-b219-a9ea94b54635)
INSERT INTO categories (discipline_id, name, description, sort_order) VALUES 
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Fundamentals', 'Essential BJJ basics every practitioner must master', 1),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Guard Basics', 'Fundamental guard positions and basic techniques', 2),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Basic Escapes', 'Essential escape techniques from common bad positions', 3),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Positional Control', 'Maintaining and improving dominant positions', 4),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Advanced Guard', 'Complex guard systems and advanced guard techniques', 5),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Submissions', 'Joint locks, chokes, and submission chains', 6),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Transitions', 'Smooth transitions between positions and submissions', 7),
    ('c0aa8e50-9013-40b9-b219-a9ea94b54635', 'Competition Strategy', 'Competition tactics, game planning, and mental preparation', 8);

-- Insert categories for Wrestling (57d58b62-ff7f-4f8e-93f3-8e30b82c45f9)
INSERT INTO categories (discipline_id, name, description, sort_order) VALUES 
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Basic Takedowns', 'Fundamental takedown techniques and setups', 1),
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Sprawls & Defense', 'Defensive wrestling and sprawling techniques', 2),
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Basic Throws', 'Essential throwing techniques and hip tosses', 3),
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Advanced Takedowns', 'Complex takedown combinations and high-level techniques', 4),
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Clinch Work', 'Close-quarters grappling and clinch techniques', 5),
    ('57d58b62-ff7f-4f8e-93f3-8e30b82c45f9', 'Ground Control', 'Maintaining control and dominance on the ground', 6);

-- Insert categories for Striking (f0e7b558-6233-4ce1-8c65-84821065e901)
INSERT INTO categories (discipline_id, name, description, sort_order) VALUES 
    ('f0e7b558-6233-4ce1-8c65-84821065e901', 'Boxing Fundamentals', 'Basic boxing techniques, stance, and footwork', 1),
    ('f0e7b558-6233-4ce1-8c65-84821065e901', 'Defensive Striking', 'Defensive techniques and counter-striking', 2),
    ('f0e7b558-6233-4ce1-8c65-84821065e901', 'Combination Techniques', 'Complex striking combinations and flow', 3),
    ('f0e7b558-6233-4ce1-8c65-84821065e901', 'Footwork & Movement', 'Advanced footwork patterns and movement', 4);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all disciplines
SELECT 
    id,
    name,
    description,
    sort_order
FROM disciplines 
ORDER BY sort_order;

-- Verify categories were created with discipline relationships
SELECT 
    d.name as discipline_name,
    c.name as category_name,
    c.description as category_description,
    c.sort_order
FROM categories c
JOIN disciplines d ON c.discipline_id = d.id
ORDER BY d.sort_order, c.sort_order;

-- Summary statistics
SELECT 
    d.name as discipline,
    COUNT(c.id) as category_count
FROM disciplines d
LEFT JOIN categories c ON d.id = c.discipline_id
GROUP BY d.id, d.name, d.sort_order
ORDER BY d.sort_order;

-- Total counts
SELECT 
    (SELECT COUNT(*) FROM disciplines) as total_disciplines,
    (SELECT COUNT(*) FROM categories) as total_categories; 