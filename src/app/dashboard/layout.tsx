'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { LayoutDashboard, Calendar, CheckSquare, BarChart3, Wallet, LogOut, Menu, X, Sparkles, ChevronDown, Receipt, HandCoins, Plug, Moon, Sun, WifiOff, RefreshCw, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FloatingChat from '@/components/FloatingChat';
import BottomNav from '@/components/BottomNav';
import OnboardingModal from '@/components/OnboardingModal';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useThemeStore } from '@/stores/themeStore';
import { useOffline } from '@/hooks/useOffline';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { resolved: currentTheme, setTheme } = useThemeStore();
  const { isOnline, pendingOps, syncStatus, manualSync } = useOffline();
  
  // Registrar Service Worker para PWA
  const { isSupported } = useServiceWorker();

  // Programar notificaciones automáticas de eventos y tareas
  useNotificationScheduler(user?.uid);

  // Registrar el token de push del dispositivo (para recordatorios con app cerrada)
  const { permission: pushPermission, enable: enablePush } = usePushRegistration(user?.uid);

  // Check first-time user for onboarding
  useEffect(() => {
    if (user) {
      const key = `lilly-onboarded-${user.uid}`;
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  // Cerrar el menú cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userMenuOpen]);

  const navigation = [
    { name: 'Panel', href: '/dashboard/overview', icon: LayoutDashboard, color: 'text-brand-navy' },
    { name: 'Calendario', href: '/dashboard/calendar', icon: Calendar, color: 'text-brand-blue' },
    { name: 'Tareas', href: '/dashboard/tasks', icon: CheckSquare, color: 'text-brand-navy' },
    { name: 'Métricas IA', href: '/dashboard/analytics', icon: BarChart3, color: 'text-brand-orange' },
    { name: 'Integraciones', href: '/dashboard/integrations', icon: Plug, color: 'text-brand-blue' },
  ];

  const financeSubItems = [
    { name: 'Resumen', href: '/dashboard/finances', icon: Wallet },
    { name: 'Deudas', href: '/dashboard/debts', icon: Receipt },
    { name: 'Cobros', href: '/dashboard/receivables', icon: HandCoins },
  ];

  const isFinanceActive = pathname.startsWith('/dashboard/finances') ||
    pathname.startsWith('/dashboard/debts') ||
    pathname.startsWith('/dashboard/receivables');

  // Auto-open finance submenu when on a finance page
  useEffect(() => {
    if (isFinanceActive) setFinanceOpen(true);
  }, [isFinanceActive]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-brand-blue/5 dark:from-background dark:to-background">
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-brand-navy focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
        >
          Ir al contenido principal
        </a>
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white/95 dark:bg-surface/95 backdrop-blur-lg shadow-xl transform transition-all duration-300 ease-out lg:translate-x-0 border-r border-gray-200/50 dark:border-border-custom ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-border-custom">
              <div className="flex items-center gap-2">
                <div className="bg-brand-navy p-2 rounded-xl shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-brand-navy bg-clip-text text-transparent">
                  Lilly AI
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
            <div className="p-4 border-b border-gray-100 dark:border-border-custom">
              <div 
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-secondary cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-brand-navy flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                    {user?.displayName || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-text-tertiary truncate">{user?.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {/* User dropdown menu */}
              {userMenuOpen && (
                <div className="mt-2 py-2 bg-white dark:bg-surface rounded-xl shadow-lg border border-gray-100 dark:border-border-custom animate-fade-in">
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
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Navegación principal">
              {navigation.slice(0, 3).map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-brand-navy/10 dark:bg-brand-blue/10 text-brand-navy dark:text-brand-blue shadow-sm border border-brand-blue/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-secondary hover:text-gray-900 dark:hover:text-foreground'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`p-2 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-brand-navy text-white shadow-md' 
                        : 'bg-gray-100 dark:bg-surface-secondary group-hover:bg-gray-200 dark:group-hover:bg-[#2a2a4a]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-6 bg-brand-navy dark:bg-brand-blue rounded-full animate-indicator-pop" />
                    )}
                  </Link>
                );
              })}

              {/* Finanzas collapsible group */}
              <div>
                <button
                  onClick={() => setFinanceOpen(!financeOpen)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isFinanceActive
                      ? 'bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 text-brand-orange shadow-sm border border-brand-orange/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-secondary hover:text-gray-900 dark:hover:text-foreground'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-all ${
                    isFinanceActive
                      ? 'bg-gradient-to-r from-brand-orange to-[#ffc857] text-white shadow-md'
                      : 'bg-gray-100 dark:bg-surface-secondary group-hover:bg-gray-200 dark:group-hover:bg-[#2a2a4a]'
                  }`}>
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="font-medium">Finanzas</span>
                  <ChevronDown className={`ml-auto w-4 h-4 transition-transform duration-200 ${financeOpen ? 'rotate-180' : ''} ${isFinanceActive ? 'text-brand-orange' : 'text-gray-400'}`} />
                </button>

                {financeOpen && (
                  <div className="mt-1 ml-4 pl-4 border-l-2 border-gray-100 dark:border-border-custom space-y-0.5 animate-expand-down">
                    {financeSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                            isSubActive
                              ? 'bg-brand-orange/10 text-brand-orange font-medium'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-secondary hover:text-gray-700 dark:hover:text-foreground'
                          }`}
                        >
                          <SubIcon className={`w-4 h-4 ${isSubActive ? 'text-brand-orange' : 'text-gray-400'}`} />
                          <span>{sub.name}</span>
                          {isSubActive && (
                            <div className="ml-auto w-1 h-4 bg-brand-orange rounded-full" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {navigation.slice(3).map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-brand-navy/10 dark:bg-brand-blue/10 text-brand-navy dark:text-brand-blue shadow-sm border border-brand-blue/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-secondary hover:text-gray-900 dark:hover:text-foreground'
                    }`}
                    style={{ animationDelay: `${(index + 4) * 50}ms` }}
                  >
                    <div className={`p-2 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-brand-navy text-white shadow-md' 
                        : 'bg-gray-100 dark:bg-surface-secondary group-hover:bg-gray-200 dark:group-hover:bg-[#2a2a4a]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-6 bg-brand-navy dark:bg-brand-blue rounded-full animate-indicator-pop" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom section */}
            <div className="p-4 border-t border-gray-100 dark:border-border-custom">
              <div className="flex items-center justify-between p-3 bg-brand-navy/5 dark:bg-surface-secondary rounded-xl mb-2">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Versión Beta</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Lilly AI</p>
                </div>
                <button
                  onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg bg-white dark:bg-surface border border-gray-200 dark:border-border-custom hover:bg-gray-50 dark:hover:bg-[#2a2a4a] transition-all"
                  title={currentTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                >
                  {currentTheme === 'dark' ? <Sun className="w-4 h-4 text-brand-orange icon-spin-transition" /> : <Moon className="w-4 h-4 text-brand-navy icon-spin-transition" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-72 min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-10 bg-white/80 dark:bg-surface/80 backdrop-blur-lg shadow-sm border-b border-gray-100 dark:border-border-custom">
            <div className="flex items-center justify-between px-4 lg:px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-foreground hover:bg-gray-100 dark:hover:bg-surface-secondary rounded-xl transition-all"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-foreground">
                    {navigation.find((item) => item.href === pathname)?.name || financeSubItems.find((item) => item.href === pathname)?.name || 'Dashboard'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-text-secondary hidden sm:block">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {/* Mobile user avatar */}
              <div className="flex items-center gap-2">
                {!isOnline && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs font-medium">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sin conexión</span>
                    {pendingOps > 0 && <span>({pendingOps})</span>}
                  </div>
                )}
                {isOnline && pendingOps > 0 && (
                  <button
                    onClick={manualSync}
                    disabled={syncStatus.syncing}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
                    <span>Sincronizando ({pendingOps})</span>
                  </button>
                )}
                <NotificationCenter />
                <div className="lg:hidden">
                  <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold">
                      {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Push notification opt-in banner */}
          {pushPermission === 'default' && (
            <div className="mx-4 lg:mx-6 mt-4 flex items-center gap-3 p-3 bg-brand-blue/10 border border-brand-blue/30 rounded-xl">
              <div className="bg-brand-navy p-2 rounded-lg shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-navy dark:text-brand-blue">Activa los recordatorios</p>
                <p className="text-xs text-gray-600 dark:text-text-secondary">Recibe avisos de tus eventos y tareas aunque la app esté cerrada.</p>
              </div>
              <button
                onClick={() => enablePush()}
                className="shrink-0 px-3 py-1.5 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 transition-colors"
              >
                Activar
              </button>
            </div>
          )}

          {/* Page content */}
          <main id="main-content" role="main" className="p-4 lg:p-6 pb-20 lg:pb-6 animate-fade-in" style={{ viewTransitionName: 'page-content' }}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>

        {/* Floating Chat */}
        <FloatingChat />

        {/* Bottom Navigation (mobile) */}
        <BottomNav onOpenChat={() => {
          // Dispatch a custom event that FloatingChat can listen to
          window.dispatchEvent(new CustomEvent('open-lilly-chat'));
        }} />

        {/* Onboarding modal for first-time users */}
        {showOnboarding && (
          <OnboardingModal onComplete={() => {
            setShowOnboarding(false);
            if (user) localStorage.setItem(`lilly-onboarded-${user.uid}`, '1');
          }} />
        )}
      </div>
    </ProtectedRoute>
  );
}
