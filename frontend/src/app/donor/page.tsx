"use client";
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/lib/api';

export default function DonorDashboard() {
  const user = useAuthStore(state => state.user);
  const [rescue, setRescue] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetch(`${API_BASE_URL}/rescue?donor_id=${user.id}`)
        .then(res => res.json())
        .then(data => setRescue(data));
    }
  }, [user]);

  if (!user || user.role !== 'Donor') return <div>Access Denied</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Donor Dashboard</h1>
      <h2 className="text-xl font-bold mb-4">Your Rescue Postings</h2>
      <div className="flex flex-col gap-4">
        {rescue.map((item: any) => (
          <div key={item.id} className="p-4 border rounded shadow-sm">
            <p><strong>Category:</strong> {item.category}</p>
            <p><strong>Quantity:</strong> {item.quantity_kg} kg</p>
            <p><strong>Status:</strong> {item.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
