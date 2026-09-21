-- La catégorie utilise les clés du widget (bug-visuel, ajustement, a-classer…)
alter table public.annotations alter column categorie set default 'a-classer';
