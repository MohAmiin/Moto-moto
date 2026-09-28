import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/lib/types';

export type OrderDetail = {
  order: Order;
  items: OrderItem[];
  storeName: string | null;
  customer: { full_name: string; phone: string | null } | null;
  rider: { full_name: string; phone: string | null; plate: string | null } | null;
};

/** Loads one order with its items and the people involved, and keeps it live. */
export function useOrder(id: number) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const { data: order } = await supabase.from('orders').select('*, stores(name)').eq('id', id).maybeSingle();
    if (!order) {
      setMissing(true);
      return;
    }
    const [items, customer, rider, application] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', id).order('id'),
      supabase.from('profiles').select('full_name, phone').eq('id', order.customer_id).maybeSingle(),
      order.rider_id ? supabase.from('profiles').select('full_name, phone').eq('id', order.rider_id).maybeSingle() : Promise.resolve({ data: null }),
      order.rider_id ? supabase.from('rider_applications').select('plate').eq('user_id', order.rider_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const { stores, ...rest } = order as Order & { stores: { name: string } | null };
    setDetail({
      order: rest,
      items: (items.data as OrderItem[]) ?? [],
      storeName: stores?.name ?? null,
      customer: customer.data ?? null,
      rider: rider.data ? { ...rider.data, plate: application.data?.plate ?? null } : null,
    });
  }, [id]);

  useEffect(() => {
    // Load once the channel settles (subscribed or failed) so no update is missed in between.
    let loaded = false;
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .subscribe(() => {
        if (loaded) return;
        loaded = true;
        load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  return { detail, missing, reload: load };
}
