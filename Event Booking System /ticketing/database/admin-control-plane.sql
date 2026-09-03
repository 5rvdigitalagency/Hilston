-- Apply after database/admin-workspace.sql.

alter table event_categories add column if not exists sort_order integer not null default 0;
create index if not exists event_categories_order_idx on event_categories (organization_id, sort_order, name);

update event_categories
set sort_order = case slug
  when 'featured' then 10
  when 'upcoming' then 20
  when 'popular' then 30
  else sort_order
end
where slug in ('featured', 'upcoming', 'popular');