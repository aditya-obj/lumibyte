'use client'
import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/components/firebase.config';
import { get, ref } from 'firebase/database';
import { useAuthState } from 'react-firebase-hooks/auth';
import { format, parseISO, eachDayOfInterval, subMonths, startOfDay, endOfDay, isSameDay } from 'date-fns';
import Link from 'next/link';
import ActivityHeatmap from '@/components/ActivityHeatmap';

export default function Dashboard() {
  const [view, setView] = useState('all'); // 'all' or 'revised'
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user] = useAuthState(auth);

  const createSlug = (text) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      return format(timestamp, 'MMM d, yyyy h:mm a');
    } catch (e) {
      console.error("Date formatting error:", e);
      return 'Invalid date';
    }
  };

  const getDifficultyStyles = (difficulty) => {
    const level = difficulty.toLowerCase();
    if (level === 'easy') return 'bg-green-500/20 text-green-400 border border-green-400/30';
    if (level === 'medium') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30';
    return 'bg-red-500/20 text-red-400 border border-red-400/30';
  };

  useEffect(() => {
    if (user) {
      const questionsRef = ref(db, `users/${user.uid}/questions`);
      get(questionsRef).then((snapshot) => {
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
        setLoading(false);
      });
    }
  }, [user]);

  const groupedQuestions = useMemo(() => {
    if (view === 'revised') {
      return {
        'Recently Revised': [...questions]
          .filter(q => q.lastRevised)
          .sort((a, b) => b.lastRevised - a.lastRevised)
      };
    }
    
    // Group questions by topic
    return questions.reduce((acc, question) => {
      const topic = question.topic || 'Uncategorized';
      if (!acc[topic]) {
        acc[topic] = [];
      }
      acc[topic].push(question);
      return acc;
    }, {});
  }, [questions, view]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Activity Heatmap */}
      {!loading && questions.length > 0 && (
        <div className="mb-8">
          <ActivityHeatmap questions={questions} />
        </div>
      )}

      {/* View Switch */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-800/50 p-1 rounded-xl">
          <button
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${
              view === 'all'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Programs
          </button>
          <button
            onClick={() => setView('revised')}
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${
              view === 'revised'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Revised
          </button>
        </div>
      </div>

      {/* Questions Grid */}
      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedQuestions).map(([topic, topicQuestions]) => (
            <div key={topic} className="space-y-4">
              <h2 className="text-2xl font-bold text-white/90 border-b border-gray-700 pb-2">
                {topic}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({topicQuestions.length} {topicQuestions.length === 1 ? 'question' : 'questions'})
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topicQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg transition-all duration-300 hover:shadow-[0_4px_20px_rgba(79,70,229,0.15)] p-6"
                  >
                    <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
                      <h2 className="text-xl font-semibold text-white leading-tight">
                        {question.title}
                      </h2>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyStyles(question.difficulty)}`}>
                        {question.difficulty}
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between gap-4">
                      {question.lastRevised ? (
                        <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-gray-300 whitespace-nowrap">{formatDate(question.lastRevised)}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">Not revised yet</div>
                      )}
                      
                      <Link 
                        href={`/${createSlug(question.topic)}/${createSlug(question.title)}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/90 to-indigo-500/90 text-white rounded-lg transition-all duration-300 hover:from-blue-600 hover:to-indigo-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 group whitespace-nowrap"
                      >
                        Visit Question
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
