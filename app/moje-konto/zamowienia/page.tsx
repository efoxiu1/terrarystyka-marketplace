'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function MojeZamowienia() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error) setOrders(data);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  if (loading) return <div className="p-10 text-center font-black">ŁADOWANIE TWOICH ZAKUPÓW...</div>;

  return (
    <main className="max-w-4xl mx-auto p-6 min-h-screen">
      <h1 className="text-4xl font-black mb-8 italic uppercase">Moje Zamówienia</h1>
      
      <div className="space-y-4">
        {orders.length === 0 ? (
          <p className="text-gray-500 font-bold">Nie masz jeszcze żadnych zamówień. Czas coś kupić!</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">ID Zamówienia</p>
                  <p className="font-mono text-sm">{order.id.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase ${
                    order.status === 'paid' ? 'bg-green-400 text-black' : 'bg-yellow-300 text-black'
                  }`}>
                    {order.status === 'paid' ? '✅ Opłacone' : '⏳ Czeka na płatność'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <p className="text-3xl font-black">{order.total_amount.toFixed(2)} PLN</p>
                <p className="text-xs font-bold text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('pl-PL')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-12">
        <Link href="/" className="bg-black text-white px-6 py-3 font-black uppercase hover:bg-gray-800 transition">
          Wróć do sklepu
        </Link>
      </div>
    </main>
  );
}