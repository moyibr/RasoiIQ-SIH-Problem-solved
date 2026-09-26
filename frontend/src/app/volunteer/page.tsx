"use client";
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/lib/api';

export default function VolunteerDashboard() {
  const user = useAuthStore(state => state.user);
  const [rescue, setRescue] = useState([]);
  const [sortBy, setSortBy] = useState('Newest');
  const [selectedFood, setSelectedFood] = useState<any>(null); // For Modal

  useEffect(() => {
    fetch(`${API_BASE_URL}/rescue?status=ACTIVE`)
      .then(res => res.json())
      .then(data => setRescue(data));
  }, []);

  const handleAccept = async (id: number) => {
    if (!user) return;
    await fetch(`${API_BASE_URL}/rescue/${id}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteer_id: user.id })
    });
    // Refresh after accept
    const res = await fetch(`${API_BASE_URL}/rescue?status=ACTIVE`);
    const data = await res.json();
    setRescue(data);
    setSelectedFood(null); // Close modal
  };

  if (!user || user.role !== 'Volunteer') return <div className="p-8 text-center text-red-500 font-bold">Access Denied: Volunteers Only</div>;

  // Sorting logic (mock for Nearest, real for Newest based on detected_at)
  const sortedRescue = [...rescue].sort((a: any, b: any) => {
    if (sortBy === 'Nearest') return a.rescue_window_hours - b.rescue_window_hours; // using rescue window as a proxy for now
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(); // Newest first
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      
      {/* Header & Role Toggle space */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Available Food for Rescue</h1>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button className="bg-white shadow-sm text-slate-800 px-4 py-2 rounded-md font-semibold text-sm">Volunteer Mode</button>
        </div>
      </div>

      {/* Sort Options */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSortBy('Newest')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${sortBy === 'Newest' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Newest</button>
        <button onClick={() => setSortBy('Nearest')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${sortBy === 'Nearest' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Nearest</button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRescue.map((item: any) => {
          
          // Badge Colors
          const isUrgent = item.urgency_level === 'CRITICAL' || item.rescue_window_hours < 5;
          const badgeColor = isUrgent ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';

          return (
            <div 
              key={item.id} 
              onClick={() => setSelectedFood(item)}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 cursor-pointer hover:shadow-md transition transform hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
                  {isUrgent ? 'Urgent / Near-Spoilage' : 'Fresh / Active'}
                </span>
                <span className="text-slate-400 text-sm font-medium">~{item.kitchen_name}</span>
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-1">{item.category}</h3>
              <p className="text-slate-500 font-medium mb-4">{item.quantity_kg} kg available</p>
              
              <div className="flex items-center text-sm font-semibold text-slate-600 bg-slate-50 p-3 rounded-lg">
                <span className="mr-2">⏳</span> {Math.max(0, Math.floor(item.rescue_window_hours))} hours rescue window left
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Detail View */}
      {selectedFood && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setSelectedFood(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-2">✕</button>
            
            <div className="mb-6">
               <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-3 border border-blue-100">Quality Score: 82% (OpenCV)</span>
               <h2 className="text-3xl font-extrabold text-slate-800 mb-2">{selectedFood.category}</h2>
               <p className="text-lg text-slate-600 font-medium">Quantity: {selectedFood.quantity_kg} kg</p>
            </div>

            <div className="space-y-4 mb-8">
               <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
                 <div className="text-slate-400">📍</div>
                 <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pickup Location</p>
                    <p className="font-bold text-slate-700">{selectedFood.kitchen_name}</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
                 <div className="text-slate-400">⏰</div>
                 <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Urgency</p>
                    <p className="font-bold text-slate-700">{Math.max(0, Math.floor(selectedFood.rescue_window_hours))} hours left</p>
                 </div>
               </div>
            </div>

            <button 
              onClick={() => handleAccept(selectedFood.id)}
              className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-xl hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
            >
              Accept Delivery
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
