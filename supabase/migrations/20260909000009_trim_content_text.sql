-- tiptap_to_text() ended documents with a newline (btrim only strips spaces),
-- so content_text carried trailing whitespace whenever the caller left it to
-- the database. Trim at the document level and repair existing rows.
create or replace function public.tiptap_to_text(p_node jsonb)
returns text
language plpgsql immutable
as $$
declare
  v_type text := p_node ->> 'type';
  v_out text := '';
  v_child jsonb;
begin
  if p_node is null or jsonb_typeof(p_node) <> 'object' then
    return '';
  end if;
  if v_type = 'text' then
    return coalesce(p_node ->> 'text', '');
  elsif v_type = 'hardBreak' then
    return E'\n';
  elsif v_type = 'mention' then
    return '@' || coalesce(p_node -> 'attrs' ->> 'label', p_node -> 'attrs' ->> 'id', '');
  elsif v_type = 'emoji' then
    return coalesce(p_node -> 'attrs' ->> 'emoji', ':' || (p_node -> 'attrs' ->> 'name') || ':', '');
  end if;
  if jsonb_typeof(p_node -> 'content') = 'array' then
    for v_child in select * from jsonb_array_elements(p_node -> 'content') loop
      v_out := v_out || public.tiptap_to_text(v_child);
    end loop;
  end if;
  if v_type in ('paragraph', 'heading', 'codeBlock', 'blockquote', 'listItem', 'bulletList', 'orderedList') then
    v_out := v_out || E'\n';
  end if;
  if v_type = 'doc' then
    return btrim(v_out, E' \n\t\r');
  end if;
  return v_out;
end;
$$;

update public.messages
set content_text = btrim(content_text, E' \n\t\r')
where content_text <> btrim(content_text, E' \n\t\r');
