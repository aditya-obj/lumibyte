'use client';

import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/components/firebase.config';
import { ref, get } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Administration() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('all');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Public Questions Administration</h1>
          <Link
            href="/admin/questions"
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:shadow-lg transition-all duration-300"
          >
            Add New Question
          </Link>
        </div>

        {/* Topic Filter */}
        <div className="mb-8">
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="bg-gray-800 text-white rounded-xl px-4 py-2 border border-gray-700"
          >
            {uniqueTopics.map(topic => (
              <option key={topic} value={topic}>
                {topic === 'all' ? 'All Topics' : topic}
              </option>
            ))}
          </select>
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
                    className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-colors duration-200"
                  >
                    <h3 className="text-xl font-medium mb-2">{question.title}</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        question.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                        question.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {question.difficulty}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/questions?edit=true&id=${question.id}`}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
