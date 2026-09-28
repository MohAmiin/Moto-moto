-- Sample stores so the app has something to show. Replace with real partners before launch.

with s as (
  insert into public.stores (name, description, category, district, eta_label) values
    ('Maqaayadda Barwaaqo', 'Bariis, baasto iyo hilib', 'food', 'Hodan', '25–35'),
    ('Bunna House', 'Shaah, qaxwo iyo quraac', 'cafe', 'Hodan', '15–25'),
    ('Pizza Badda', 'Pizza, burger iyo baradho', 'food', 'Wadajir', '30–40'),
    ('Raashinka Dhaqso', 'Caano, rooti, bariis iyo sonkor', 'shop', 'Hawl-Wadaag', '20–30'),
    ('Farmashiyaha Caafimaad', 'Daawooyin aan warqad u baahnayn', 'pharma', 'Waaberi', '20–30')
  returning id, name
)
insert into public.products (store_id, name, description, price, sort_order)
select s.id, p.name, p.description, p.price, p.sort_order
from s join (values
  ('Maqaayadda Barwaaqo', 'Bariis iyo hilib ari', 'Bariis basmati, hilib ari, moos iyo basbaas', 5.00, 1),
  ('Maqaayadda Barwaaqo', 'Baasto iyo hilib lo''aad', 'Baasto suugo leh iyo hilib lo''aad', 4.00, 2),
  ('Maqaayadda Barwaaqo', 'Sugaar', 'Hilib jarjaran oo khudaar lagu shiilay', 3.50, 3),
  ('Maqaayadda Barwaaqo', 'Muufo iyo maraq', 'Muufo kulul iyo maraq hilib', 3.00, 4),
  ('Bunna House', 'Shaah cadays', 'Shaah caano leh, heyl iyo qorfe', 1.00, 1),
  ('Bunna House', 'Qaxwada Bunna', 'Qaxwo sanjabiil iyo heyl leh', 2.00, 2),
  ('Bunna House', 'Canjeero iyo beer', 'Canjeero, beer iyo basal la shiilay', 4.00, 3),
  ('Bunna House', 'Sambuusa (3 xabbo)', 'Sambuusa hilib lo''aad oo xawaash leh', 1.50, 4),
  ('Pizza Badda', 'Pizza hilib', 'Hilib lo''aad, farmaajo iyo basal', 7.00, 1),
  ('Pizza Badda', 'Pizza khudaar', 'Yaanyo, basbaas cagaar iyo zaytuun', 6.00, 2),
  ('Pizza Badda', 'Burger hilib', 'Burger hilib lo''aad iyo farmaajo', 4.50, 3),
  ('Pizza Badda', 'Baradho shiilan', 'Baradho qalalan oo milix leh', 2.00, 4),
  ('Raashinka Dhaqso', 'Caano (1L)', 'Caano geel oo cusub', 1.50, 1),
  ('Raashinka Dhaqso', 'Rooti', 'Rooti maanta la dubay', 0.50, 2),
  ('Raashinka Dhaqso', 'Ukun (12 xabbo)', 'Ukun digaag', 3.00, 3),
  ('Raashinka Dhaqso', 'Bariis (5kg)', 'Bariis basmati', 6.00, 4),
  ('Farmashiyaha Caafimaad', 'Paracetamol (20)', 'Xanuun iyo qandho', 1.00, 1),
  ('Farmashiyaha Caafimaad', 'ORS (5 bac)', 'Biyo-baxa ka hortag', 0.50, 2),
  ('Farmashiyaha Caafimaad', 'Maaskaro (10)', 'Maaskaro caafimaad', 1.00, 3)
) as p(store_name, name, description, price, sort_order) on p.store_name = s.name;
