import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center text-center p-4">
      <h1 className="text-5xl font-bold text-slate-800 mb-6">RasoiIQ</h1>
      <p className="text-xl text-slate-600 mb-8 max-w-2xl">
        AI-Powered Food Reduction & Rescue Distribution Management. Connect donors with volunteers to eliminate food waste.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
          Login
        </Link>
        <Link href="/signup" className="px-6 py-3 bg-white text-blue-600 border border-blue-600 font-medium rounded-lg hover:bg-blue-50 transition">
          Sign Up
        </Link>
      </div>
    </div>
  );
}
