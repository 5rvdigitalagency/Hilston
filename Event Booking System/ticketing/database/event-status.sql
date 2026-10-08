-- Separates event status (lifecycle) from event category (genre/type). Safe to rerun.
-- Status is derived from published / archived_at / cancelled_at / schedule, never stored as a category.

alter table events add column if not exists cancelled_at timestamptz;
create index if not exists events_cancelled_idx on events (organization_id, cancelled_at);

-- The original seed categories described a status ("Upcoming event") rather than a genre.
-- Rename them in place to genuine categories; existing events keep the same category_id.
update event_categories set name = 'Live Entertainment', slug = 'live-entertainment' where slug = 'featured';
update event_categories set name = 'Family', slug = 'family' where slug = 'upcoming';
update event_categories set name = 'Seasonal', slug = 'seasonal' where slug = 'popular';

insert into event_categories (organization_id, name, slug)
select organizations.id, defaults.name, defaults.slug
from organizations
cross join (values
  ('Murder Mystery', 'murder-mystery'),
  ('Dining', 'dining'),
  ('Wedding', 'wedding'),
  ('Conference', 'conference')
) as defaults(name, slug)
on conflict (organization_id, slug) do nothing;
