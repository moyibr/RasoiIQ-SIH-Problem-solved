'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, AlertTriangle, Map as MapIcon, BarChart2, BrainCircuit, Factory, Camera, Leaf, Cpu } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { api, API_BASE_URL } from '@/lib/api';

export default function Sidebar() {
  const pathname = usePathname();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<number>(0);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  useEffect(() => {
    async function ping() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
        const data = await res.json();
        setBackendOk(res.ok && data.status === 'ok');
      } catch {
        setBackendOk(false);
      }
    }
    ping();
    const id = setInterval(ping, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function checkAlerts() {
      try {
        const summary = await api.getDashboardSummary();
        setActiveAlerts(summary.active_rescue_count);
      } catch {
        // ignore
      }
    }
    checkAlerts();
    const id = setInterval(checkAlerts, 15_000);
    return () => clearInterval(id);
  }, []);

  const links = [
    { href: '/dashboard', label: 'Dashboard',         icon: LayoutDashboard },
    { href: '/andaza',   label: 'ANYA Ai',            icon: BrainCircuit    },
    { href: '/quality',   label: 'Quality Check',         icon: Camera          },
    { href: '/rescue',   label: 'Rescue Events', icon: AlertTriangle, hasAlerts: activeAlerts > 0 },
    { href: '/map',             label: 'Live Dispatch',      icon: MapIcon         },
    { href: '/processing-unit', label: 'Processing Unit',     icon: Factory         },
    { href: '/iot-monitor', label: 'IoT Monitor',         icon: Cpu             },
    { href: '/esg-report',  label: 'ESG Report',          icon: Leaf            },
    { href: '/reports',         label: 'Telemetry',             icon: BarChart2       },
  ];

  return (
    <aside className="fixed left-0 top-0 w-[260px] h-full bg-white border-r border-[#E2E8F0] flex flex-col z-50">
      {/* Brand Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <Leaf className="text-status-success" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-content-primary mb-6">RasoiIQ</h1>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 px-1">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-accent-secondary/50 to-transparent" />
          <span className="text-[9px] font-mono text-content-secondary tracking-wide uppercase">SYS_CONSOLE</span>
        </div>
      </div>

      <nav className="flex-1 mt-6 flex flex-col gap-2 px-4" onMouseLeave={() => setHoveredPath(null)}>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHoveredPath(link.href)}
              className={clsx(
                'group flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-display font-bold tracking-wider uppercase transition-colors relative z-10',
                isActive
                  ? 'text-accent-primary'
                  : 'text-content-secondary hover:text-content-primary'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activePill"
                  className="absolute inset-0 bg-[#16A34A]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              
              {hoveredPath === link.href && !isActive && (
                <motion.div
                  layoutId="hoverPill"
                  className="absolute inset-0 bg-slate-100 rounded-xl -z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}

              <Icon 
                size={18} 
                className={clsx(
                  "transition-all duration-300", 
                  isActive ? "text-accent-primary" : "group-hover:scale-110"
                )} 
              />
              <span className="flex-1 pt-0.5">{link.label}</span>
              
              {link.hasAlerts && (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  className="w-2 h-2 rounded-full bg-status-critical" 
                  title={`${activeAlerts} active alerts`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-6">
        <div className="p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] flex items-center gap-3 relative overflow-hidden group">
          
          <div className="relative">
            {backendOk === null ? (
              <div className="w-2.5 h-2.5 rounded-full bg-content-secondary" />
            ) : backendOk ? (
              <div className="w-2.5 h-2.5 rounded-full bg-status-success" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-status-critical" />
            )}
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] text-content-secondary font-mono tracking-wide uppercase">
              Core Backend
            </span>
            <span className={clsx(
              "text-xs font-bold font-mono tracking-wider uppercase mt-0.5",
              backendOk === null ? 'text-content-secondary' : backendOk ? 'text-status-success' : 'text-status-critical'
            )}>
              {backendOk === null ? 'CONNECTING...' : backendOk ? 'SECURE / ONLINE' : 'SYS OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}