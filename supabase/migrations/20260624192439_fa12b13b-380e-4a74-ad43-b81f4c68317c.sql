UPDATE public.books
   SET genre = 'Socialism',
       genre_ml = 'സോഷ്യലിസം'
 WHERE genre = 'സോഷ്യലിസം'
    OR genre_ml = 'സോഷ്യലിസം';