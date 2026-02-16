'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { LayoutDashboard, Calendar, CheckSquare, BarChart3, Wallet, LogOut, Menu, X, Sparkles, ChevronDown, Receipt, HandCoins } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FloatingChat from '@/components/FloatingChat';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  
  // Registrar Service Worker para PWA
  const { isSupported } = useServiceWorker();

  // Cerrar el menú cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userMenuOpen]);

  const navigation = [
    { name: 'Panel', href: '/dashboard/overview', icon: LayoutDashboard, color: 'text-blue-600' },
    { name: 'Calendario', href: '/dashboard/calendar', icon: Calendar, color: 'text-purple-600' },
    { name: 'Tareas', href: '/dashboard/tasks', icon: CheckSquare, color: 'text-green-600' },
    { name: 'Finanzas', href: '/dashboard/finances', icon: Wallet, color: 'text-emerald-600' },
    { name: 'Deudas', href: '/dashboard/debts', icon: Receipt, color: 'text-rose-600' },
    { name: 'Cobros', href: '/dashboard/receivables', icon: HandCoins, color: 'text-cyan-600' },
    { name: 'Métricas IA', href: '/dashboard/analytics', icon: BarChart3, color: 'text-orange-600' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white/95 backdrop-blur-lg shadow-xl transform transition-all duration-300 ease-out lg:translate-x-0 border-r border-gray-200/50 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Agenda AI
                </h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info */}
            <div className="p-4 border-b border-gray-100">
              <div 
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.displayName || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {/* User dropdown menu */}
              {userMenuOpen && (
                <div className="mt-2 py-2 bg-white rounded-xl shadow-lg border border-gray-100 animate-fade-in">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 shadow-sm border border-blue-100'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`p-2 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md' 
                        : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom section */}
            <div className="p-4 border-t border-gray-100">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                <p className="text-xs text-gray-600 mb-1">Versión Beta</p>
                <p className="text-xs text-gray-500">Agenda AI Personal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-72 min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100">
            <div className="flex items-center justify-between px-4 lg:px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {navigation.find((item) => item.href === pathname)?.name || 'Dashboard'}
                  </h2>
                  <p className="text-sm text-gray-500 hidden sm:block">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {/* Mobile user avatar */}
              <div className="lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold">
                    {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-6 animate-fade-in">{children}</main>
        </div>

        {/* Floating Chat */}
        <FloatingChat />
      </div>
    </ProtectedRoute>
  );
}
