import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ResetPasswordPage from './pages/ResetPassword';
import AuthPage from './pages/Auth';
import ChatPage from './pages/Chat';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Church } from 'lucide-react';
import Live from './pages/Live';
import io from 'socket.io-client';
import { SOCKET_URL, apiClient } from "@/api/base44Client";
import React, { useState, useEffect, useRef } from "react";

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const SplashScreen = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1a2744] text-white">
    <div className="w-24 h-24  rounded-full bg-[#ffff] flex items-center justify-center animate-pulse">
      <img src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png" alt="Church Icon" className="w-24 h-24" />
    </div>
    <h1 className="text-3xl font-bold font-serif tracking-wider mb-2">MUTSDA</h1>
    <p className="text-[#c8a951] text-xs uppercase tracking-widest mb-12">Seventh-Day Adventist Church</p>
    
    <div className="flex gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
    </div>
  </div>
);

const AuthenticatedApp = () => {
 
  const { isLoading, user } = useAuth();// Assuming useAuth provides the logged-in user
  const socketRef = useRef(null);
  useEffect(() => {
    // Initialize socket at the App level
    socketRef.current = io(SOCKET_URL, {
      extraHeaders: { "ngrok-skip-browser-warning": "true" }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    // Site-wide Activity: Mark user online if they are authenticated
    if (user && socketRef.current) {
      socketRef.current.emit('i_am_online', user);
      
      // Optional: Periodic heartbeat to keep session fresh
      const heartbeat = setInterval(() => {
        socketRef.current.emit('i_am_online', user);
      }, 30000); // every 30 seconds

      return () => clearInterval(heartbeat);
    }
  }, [user]);
  
  // Show a global loading spinner while the initial authentication check is running.
  if (isLoading) {
    return <SplashScreen />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Add a dedicated route for the new Auth page that does not use the main layout */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/chat" element={
        <LayoutWrapper currentPageName="Chat">
          <ChatPage />
        </LayoutWrapper>
      }
      />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/Live" element={<Live />} />

      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function DeepLinkHandler({ children }) {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  useEffect(() => {
    const setupDeepLink = async () => {
      const { App } = await import('@capacitor/app');
      await App.addListener('appUrlOpen', (event) => {
        const url = new URL(event.url);
        const { pathname, searchParams } = url;

        if (pathname === '/auth/callback' || url.href.startsWith('mutsdaapp://auth/callback')) {
          const token = searchParams.get('token');
          if (token) {
            localStorage.setItem('token', token);
            checkUserAuth().then(() => navigate('/', { replace: true }));
          } else {
            navigate('/auth?view=login', { replace: true });
          }
        }

        if (pathname === '/payment/callback' || url.href.startsWith('mutsdaapp://payment/callback')) {
          const ref = searchParams.get('reference');
          if (ref) {
            navigate(`/payment/success?reference=${ref}`, { replace: true });
          }
        }
      });
    };

    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      setupDeepLink();
    }
  }, []);

  return children;
}

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <DeepLinkHandler>
            <AuthenticatedApp />
          </DeepLinkHandler>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
