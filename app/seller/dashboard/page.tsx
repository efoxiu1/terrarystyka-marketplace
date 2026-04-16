'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase'; // Upewnij się, że ścieżka jest poprawna!
import { useRouter } from 'next/navigation';

export default function SellerDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
   const fetchSellerOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // 🔥 POPRAWKA: Prawidłowe nazwy kolumn ('price') i uproszczone relacje
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          price_at_purchase, 
          orders!inner(id, created_at, status, shipping_details),
          listings!inner(id, title, seller_id)
        `)
        .eq('listings.seller_id', user.id)
        .eq('orders.status', 'paid')
        .order('id', { ascending: false });

      if (error) {
        // Rentgen: jeśli znowu wywali błąd, rozwiń go w konsoli!
        console.error("❌ BŁĄD SUPABASE (POBIERANIE ZAMÓWIEŃ):", error);
        setLoading(false);
        return;
      }

      const groupedOrders: Record<string, any> = {};
      
      data?.forEach((item: any) => {
        // Dostosowanie do nowych, bezpiecznych nazw z bazy
        const orderId = item.orders.id;
        
        if (!groupedOrders[orderId]) {
          groupedOrders[orderId] = {
            id: orderId,
            date: new Date(item.orders.created_at).toLocaleDateString('pl-PL', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }),
            shipping: item.orders.shipping_details,
            total_earned: 0,
            items: []
          };
        }
        
        groupedOrders[orderId].items.push({
          title: item.listings.title,
          quantity: item.quantity,
          price: item.price_at_purchase
        });
        
        // Sumujemy zarobek z uzyciem prawidlowej kolumny 'price'
        groupedOrders[orderId].total_earned += (item.price_at_purchase * item.quantity);
      });

      setOrders(Object.values(groupedOrders));
      setLoading(false);
    };

    fetchSellerOrders();
  }, [router]);

  if (loading) return <div className="p-20 text-center text-gray-500 animate-pulse font-bold text-xl">Wczytywanie Twoich zysków...</div>;

  return (
    <main className="max-w-5xl mx-auto p-6 mt-10 mb-20">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900">Panel Sprzedawcy</h1>
          <p className="text-gray-500 mt-2">Zarządzaj swoimi wysyłkami i zyskami.</p>
        </div>
        <div className="bg-green-100 text-green-800 px-6 py-3 rounded-2xl border-2 border-green-200">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Do wysłania</p>
          <p className="text-3xl font-black">{orders.length}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center text-gray-400 font-bold">
          Jeszcze nic nie sprzedałeś. Cierpliwości!
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;

            return (
              <div key={order.id} className="bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
                {/* NAGŁÓWEK ZAMÓWIENIA (Klikalny) */}
                <div 
                  className={`p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-blue-50 border-b' : ''}`}
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-6">
                    <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl">
                      📦
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">Zarobek: <span className="text-green-600">{order.total_earned.toFixed(2)} PLN</span></p>
                      <p className="text-sm text-gray-500 font-medium">Data: {order.date}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">Opłacone</span>
                    <span className="text-blue-500 font-bold text-sm">
                      {isExpanded ? 'Zwiń ▴' : 'Szczegóły ▾'}
                    </span>
                  </div>
                </div>

                {/* SZCZEGÓŁY (Rozwijane) */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Lista sprzedanych przedmiotów */}
                    <div>
                      <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Co musisz spakować:</h3>
                      <ul className="space-y-3">
                        {order.items.map((item: any, idx: number) => (
                          <li key={idx} className="flex justify-between items-center bg-white p-4 rounded-xl border">
                            <div>
                              <span className="font-bold text-gray-900">{item.title}</span>
                              <span className="text-gray-500 text-sm block">Ilość: {item.quantity}</span>
                            </div>
                            <span className="font-black text-blue-600">{(item.price * item.quantity).toFixed(2)} zł</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Dane do wysyłki */}
                    <div>
                      <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Dane adresata:</h3>
                      <div className="bg-white p-5 rounded-xl border text-sm text-gray-700 space-y-2">
                        <p><span className="font-bold">Imię i Nazwisko:</span> {order.shipping?.name}</p>
                        <p><span className="font-bold">Telefon:</span> {order.shipping?.phone}</p>
                        <p><span className="font-bold">Ulica:</span> {order.shipping?.street}</p>
                        <p><span className="font-bold">Miasto:</span> {order.shipping?.zip} {order.shipping?.city}</p>
                        
                        {order.shipping?.lockerId && (
                          <div className="mt-4 pt-4 border-t border-amber-100 bg-amber-50 p-3 rounded-lg text-amber-900">
                            <span className="font-black text-amber-800 uppercase text-xs block mb-1">Paczkomat InPost</span>
                            <span className="text-lg font-black">{order.shipping.lockerId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}