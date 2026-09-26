"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/lib/api';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const user = await res.json();
        login(user);
        if (user.role === 'Donor') router.push('/donor');
        else if (user.role === 'Volunteer') router.push('/volunteer');
        else router.push('/dashboard');
      } else {
        alert('Login failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="email" placeholder="Email" className="border p-2 rounded" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="border p-2 rounded" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
        </form>
        <p className="mt-4 text-center">
          Don't have an account? <Link href="/signup" className="text-blue-600">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
