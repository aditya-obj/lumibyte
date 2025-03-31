'use client'
import { auth } from '@/components/firebase.config';
import { updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function UpdateProfile() {
  const [user, loading, error] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const router = useRouter();

  // Redirect if user is not logged in or already has a display name
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Use replace to prevent adding update-profile to history if user logs out/isn't found
        router.replace('/'); 
      } else if (user.displayName) {
        // Use replace to prevent adding update-profile to history if name already exists
        router.replace('/dashboard'); 
      }
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;

    setIsUpdating(true);
    setUpdateError('');

    try {
      await updateProfile(user, { displayName: displayName.trim() });
      console.log("Profile updated successfully!");
      // Use replace to remove update-profile from history after successful update
      router.replace('/dashboard'); 
    } catch (err) {
      console.error("Error updating profile:", err);
      setUpdateError(err.message || 'Failed to update profile. Please try again.');
      setIsUpdating(false);
    }
  };

  // Show loading spinner while auth state is resolving
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Render form only if user exists and has no display name yet
  // (The useEffect above handles redirecting away if conditions aren't met)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-700">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Set Your Display Name
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Please enter the name you&apos;d like to use on the dashboard.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="display-name" className="sr-only">Display Name</label>
              <input
                id="display-name"
                name="displayName"
                type="text"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 placeholder-gray-400 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isUpdating}
              />
            </div>
          </div>

          {updateError && (
            <p className="text-sm text-red-400 text-center">{updateError}</p>
          )}

          <div>
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-colors ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
              disabled={isUpdating}
            >
              {isUpdating ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Save Name'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
