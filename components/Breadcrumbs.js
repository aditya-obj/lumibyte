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
    if (!slug) return ''; // Add this check for undefined/null values
    
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const generateBreadcrumbs = () => {
      const baseCrumb = { label: 'Lumibyte', path: '/' };
      
      if (!pathname) {
        setBreadcrumbs([baseCrumb]);
        return;
      }
      
      let crumbs = [baseCrumb];
      // Remove query parameters from pathname before splitting
      const cleanPathname = pathname.split('?')[0];
      const pathSegments = cleanPathname.split('/').filter(Boolean);
      
      // Handle dashboard route
      if (pathname === '/dashboard') {
        crumbs.push({ label: 'Dashboard', path: '/dashboard' });
      }
      
      // Handle admin routes
      if (cleanPathname.startsWith('/admin')) {
        crumbs.push({ label: 'Admin', path: '/admin' });
        
        // Handle admin/[topic]/[questionTitle]/edit route
        if (pathSegments.length === 4 && pathSegments[3] === 'edit') {
          const [_, topic, questionTitle] = pathSegments.slice(1, 3);
          if (topic && questionTitle) {
            crumbs.push(
              { 
                label: formatQuestionTitle(topic), 
                path: `/admin/${topic}` 
              },
              { 
                label: formatQuestionTitle(questionTitle.replace(/-/g, ' ')), 
                path: `/admin/${topic}/${questionTitle}` 
              },
              {
                label: 'Edit',
                path: cleanPathname
              }
            );
          }
        }
        // Handle admin/[topic]/[questionTitle] route
        else if (pathSegments.length === 3) {
          const [_, topic, questionTitle] = pathSegments;
          if (topic && questionTitle) {  // Add null check
            crumbs.push(
              { 
                label: formatQuestionTitle(topic), 
                path: `/admin/${topic}` 
              },
              { 
                label: formatQuestionTitle(questionTitle), 
                path: `/admin/${topic}/${questionTitle}` 
              }
            );
          }
        }
        // Handle admin/[topic] route
        else if (pathSegments.length === 2 && pathSegments[1] !== 'questions') {
          const [_, topic] = pathSegments;
          if (topic) {  // Add null check
            crumbs.push({
              label: formatQuestionTitle(topic),
              path: `/admin/${topic}`
            });
          }
        }
        // Handle admin/questions route
        else if (pathSegments[1] === 'questions') {
          crumbs.push({ label: 'Questions', path: '/admin/questions' });
        }
      }
      
      // Handle [topic]/[questionTitle]/edit route
      else if (pathSegments.length === 3 && pathSegments[2] === 'edit') {
        const [topic, questionTitle] = pathSegments.slice(0, 2);
        if (topic && questionTitle) {  // Add null check
          if (previousPath?.includes('dashboard')) {
            crumbs.push(
              { label: 'Dashboard', path: '/dashboard' },
              { 
                label: formatQuestionTitle(questionTitle), 
                path: `/${topic}/${questionTitle}` 
              },
              {
                label: 'Edit',
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
                path: `/${topic}/${questionTitle}` 
              },
              {
                label: 'Edit',
                path: pathname
              }
            );
          }
        }
      }
      // Handle [topic]/[questionTitle] route
      else if (pathSegments.length === 2) {
        const [topic, questionTitle] = pathSegments;
        if (topic && questionTitle) {  // Add null check
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
      }
      // Handle topic route
      else if (pathSegments.length === 1) {
        const topic = pathSegments[0];
        if (topic) {  // Add null check
          crumbs.push({
            label: formatQuestionTitle(topic),
            path: pathname
          });
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2 
                bg-gray-800/80 hover:bg-gray-800/90
                text-rose-300 rounded-xl transition-all duration-300 
                border border-rose-500/20
                hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]
                hover:-translate-y-0.5 group"
            >
              <svg 
                className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
              <span className="font-medium">Logout</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowLogin(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 
                bg-gray-800/80 hover:bg-gray-800/90
                text-blue-300 rounded-xl transition-all duration-300 
                border border-blue-500/20
                hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]
                hover:-translate-y-0.5 group"
            >
              <svg 
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" 
                />
              </svg>
              <span className="font-medium">Login</span>
            </button>
          )}
        </div>
      </div>
      {showLogin && <Login onClose={() => setShowLogin(false)} />}
    </nav>
  );
}
