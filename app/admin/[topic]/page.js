'use client';

import { useEffect, useState } from 'react';
import { db } from '@/components/firebase.config';
import { ref, get, remove } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PulseLoader } from 'react-spinners';
import { createSlug } from '@/utils/helpers';
import Breadcrumbs from '@/components/Breadcrumbs';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import React from 'react';

export default function TopicPage({ params }) {
  const unwrappedParams = React.use(params);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, questionId: null });
  const router = useRouter();
  const topic = unwrappedParams.topic;

  // Update handleDelete to open dialog
  const handleDelete = (questionId, e) => {
    e.preventDefault(); // Prevent the Link navigation
    setDeleteDialog({ isOpen: true, questionId });
  };

  // Handle actual deletion
  const handleConfirmDelete = async () => {
    try {
      await remove(ref(db, `public/questions/${deleteDialog.questionId}`));
      setQuestions(questions.filter(q => q.id !== deleteDialog.questionId));
      setDeleteDialog({ isOpen: false, questionId: null });
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete the question. Please try again.');
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const questionsRef = ref(db, 'public/questions');
        const snapshot = await get(questionsRef);
        
        if (snapshot.exists()) {
          const questionsData = [];
          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            if (createSlug(question.topic) === topic) {
              questionsData.push({
                id: childSnapshot.key,
                ...question
              });
            }
          });
          
          questionsData.sort((a, b) => {
            if (!a.lastRevised && !b.lastRevised) return 0;
            if (!a.lastRevised) return 1;
            if (!b.lastRevised) return -1;
            return b.lastRevised - a.lastRevised;
          });
          
          setQuestions(questionsData);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [topic]);

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-[#1a1a1a] text-gray-400 flex flex-col items-center justify-center">
        <PulseLoader color="#9333ea" size={15} margin={2} />
        <p className="mt-4 text-sm text-gray-400">Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Breadcrumbs />
      <div className="max-w-7xl mx-auto p-8">
        {questions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((question) => (
              <div
                key={question.id}
                className="group relative bg-gradient-to-br from-gray-900/40 to-gray-800/40 
                  backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 hover:shadow-lg 
                  hover:shadow-purple-500/10 transition-all duration-300 hover:border-purple-500/30"
              >
                <Link
                  href={`/admin/${topic}/${createSlug(question.title)}`}
                  className="absolute inset-0 z-10"
                />
                
                <h3 className="text-xl font-medium mb-4 text-gray-200 group-hover:text-purple-300 
                  transition-colors line-clamp-2"
                >
                  {question.title}
                </h3>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    question.difficulty === 'Easy' 
                      ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' 
                      : question.difficulty === 'Medium' 
                      ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' 
                      : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                  }`}>
                    {question.difficulty}
                  </span>

                  <span className="text-sm text-gray-400">
                    Last updated: {new Date(question.updatedAt || question.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-3 relative z-20">
                  <Link
                    href={`/admin/${topic}/${createSlug(question.title)}/edit?id=${question.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 
                      rounded-lg hover:bg-purple-500/30 transition-all duration-300 ring-1 
                      ring-purple-500/30 hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>

                  {/* Add Delete Button */}
                  <button
                    onClick={(e) => handleDelete(question.id, e)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 
                      rounded-lg hover:bg-red-500/30 transition-all duration-300 ring-1 
                      ring-red-500/30 hover:shadow-lg hover:shadow-red-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">No questions found</div>
        )}
      </div>
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, questionId: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Question"
        message="Are you sure you want to delete this question? This action cannot be undone."
      />
    </div>
  );
}
