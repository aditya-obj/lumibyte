'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '@/components/firebase.config';
import Login from '@/components/Login';

export default function Breadcrumbs({ previousPath }) {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const formatQuestionTitle = (slug) => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const generateBreadcrumbs = () => {
      const baseCrumb = { label: 'Lumibyte', path: '/' };
      
      if (pathname === '/') {
        setBreadcrumbs([baseCrumb]);
        return;
      }
      
      let crumbs = [baseCrumb];
      
      // Handle dashboard route
      if (pathname === '/dashboard') {
        crumbs.push({ label: 'Dashboard', path: '/dashboard' });
      }
      
      // Handle admin route
      else if (pathname === '/admin') {
        crumbs.push({ label: 'Admin', path: '/admin' });
      }
      
      // Handle question routes
      else if (pathname.includes('/admin/questions')) {
        crumbs.push(
          { label: 'Admin', path: '/admin' },
          { label: 'Questions', path: '/admin/questions' }
        );
      }
      
      // Handle topic route (new)
      else if (pathname.split('/').length === 2) {
        const topic = pathname.split('/')[1];
        crumbs.push({
          label: formatQuestionTitle(topic),
          path: pathname
        });
      }
      
      // Handle dynamic question routes
      else if (pathname.split('/').length === 3) {
        const [, topic, questionTitle] = pathname.split('/');
        if (previousPath?.includes('dashboard')) {
          crumbs.push(
            { label: 'Dashboard', path: '/dashboard' },
            { 
              label: formatQuestionTitle(questionTitle), 
              path: pathname 
            }
          );
        } else {
          crumbs.push(
            { 
              label: formatQuestionTitle(topic), 
              path: `/${topic}` 
            },
            { 
              label: formatQuestionTitle(questionTitle), 
              path: pathname 
            }
          );
        }
      }
      
      setBreadcrumbs(crumbs);
    };

    generateBreadcrumbs();
  }, [pathname, previousPath]);

  return (
    <nav className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-50 w-full">
      <div className="max-w-[1920px] mx-auto px-4 py-2 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm sm:text-base text-gray-400">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-gray-500">›</span>
              )}
              <Link
                href={crumb.path}
                className={`hover:text-gray-200 transition-colors ${
                  index === breadcrumbs.length - 1 ? 'text-gray-200' : ''
                }`}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>
        <div className="flex items-center">
          {user ? (
            <button 
              onClick={() => auth.signOut()}
              className="glass-button bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-1.5 rounded-xl transition-all duration-300 font-medium hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:-translate-y-1 cursor-pointer text-sm"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </span>
            </button>
          ) : (
            <button 
              onClick={() => setShowLogin(true)}
              className="glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1.5 rounded-xl transition-all duration-300 font-medium hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1 cursor-pointer text-sm"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
              </span>
            </button>
          )}
        </div>
      </div>
      {showLogin && <Login onClose={() => setShowLogin(false)} />}
    </nav>
  );
}
