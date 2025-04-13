'use client';

import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/components/firebase.config';
import { ref, get, remove } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { HashLoader } from 'react-spinners';
import { createSlug } from '@/utils/helpers';
import ConfirmationDialog from '@/components/ConfirmationDialog';

export default function Administration() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, questionId: null });
  const router = useRouter();

  useEffect(() => {
    const checkAdminAndFetchQuestions = async () => {
      const user = auth.currentUser;
      
      if (!user || user.uid !== process.env.NEXT_PUBLIC_USER_UID) {
        router.push('/');
        return;
      }

      try {
        const questionsRef = ref(db, 'public/questions');
        const snapshot = await get(questionsRef);
        
        if (snapshot.exists()) {
          const questionsData = [];
          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            questionsData.push({
              id: childSnapshot.key,
              ...question
            });
          });
          setQuestions(questionsData);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAdminAndFetchQuestions();
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Extract unique topics for the filter dropdown
  const uniqueTopics = useMemo(() => {
    const topics = new Set(questions.map(q => q.topic || 'Uncategorized'));
    return ['all', ...Array.from(topics).sort()];
  }, [questions]);

  // Group questions by topic
  const groupedQuestions = useMemo(() => {
    const filteredQuestions = questions.filter(question =>
      selectedTopic === 'all' || (question.topic || 'Uncategorized') === selectedTopic
    );

    return filteredQuestions.reduce((acc, question) => {
      const topic = question.topic || 'Uncategorized';
      if (!acc[topic]) {
        acc[topic] = [];
      }
      acc[topic].push(question);
      return acc;
    }, {});
  }, [questions, selectedTopic]);

  const handleDelete = (questionId) => {
    setDeleteDialog({ isOpen: true, questionId });
  };

  const handleConfirmDelete = async () => {
    try {
      await remove(ref(db, `public/questions/${deleteDialog.questionId}`));
      const updatedQuestions = questions.filter(q => q.id !== deleteDialog.questionId);
      setQuestions(updatedQuestions);
      setDeleteDialog({ isOpen: false, questionId: null });
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete the question. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center p-8">
          <HashLoader color="#9333ea" size={50} />
          <p className="mt-4 text-sm text-gray-400">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Breadcrumbs />
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Public Questions</h1>
          <Link
            href="/admin/questions"
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl 
              hover:shadow-lg transition-all duration-300 hover:shadow-purple-500/20"
          >
            Add New Question
          </Link>
        </div>

        {/* Improved Topic Filter */}
        <div className="mb-8 bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Filter by Topic</label>
          <div className="flex flex-wrap gap-2">
            {uniqueTopics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTopic(t)}
                className={`
                  px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                  ${selectedTopic === t
                    ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                  }
                `}
              >
                {t === 'all' ? 'All Topics' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-8">
          {Object.entries(groupedQuestions).map(([topic, topicQuestions]) => (
            <div key={topic} className="space-y-4">
              <h2 className="text-2xl font-semibold text-purple-400">{topic}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topicQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="group relative bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-xl 
                      rounded-2xl border border-gray-700/50 p-6 hover:shadow-lg hover:shadow-purple-500/10 
                      transition-all duration-300 hover:border-purple-500/30"
                  >
                    {/* Make the entire card clickable */}
                    <Link
                      href={`/admin/${createSlug(question.topic)}/${createSlug(question.title)}`}
                      className="absolute inset-0 z-10"
                    />
                    
                    {/* Title with hover effect */}
                    <h3 className="text-xl font-medium mb-4 text-gray-200 group-hover:text-purple-300 
                      transition-colors line-clamp-2"
                    >
                      {question.title}
                    </h3>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {/* Difficulty Badge */}
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        question.difficulty === 'Easy' 
                          ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' 
                          : question.difficulty === 'Medium' 
                          ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' 
                          : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                      }`}>
                        {question.difficulty}
                      </span>

                      {/* Topic Badge */}
                      <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm 
                        font-medium ring-1 ring-blue-500/30">
                        {question.topic}
                      </span>

                      {/* Creation Date */}
                      <span className="text-sm text-gray-400">
                        Created: {new Date(question.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Action Buttons - Add relative z-20 to appear above the clickable overlay */}
                    <div className="flex gap-3 relative z-20">
                      <Link
                        href={`/admin/${createSlug(question.topic)}/${createSlug(question.title)}/edit?id=${question.id}`}
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

                      <button
                        onClick={() => handleDelete(question.id)}
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

                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 
                      to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
