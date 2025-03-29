'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/components/firebase.config';
import { ref, push, get, set } from 'firebase/database';
import { marked } from 'marked';

export default function AdminQuestionsPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState(['Others']);
  const [difficulty, setDifficulty] = useState('Easy');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || user.uid !== 'Vl8iVtOQo9PZrVNKH0zG65yCWv22') {
        window.location.href = '/'; // Redirect non-admin users
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch public topics
  useEffect(() => {
    const topicsRef = ref(db, 'public/topics');
    get(topicsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const topicsData = Object.values(snapshot.val());
        setTopics([...topicsData, 'Others']);
      } else {
        setTopics(['Others']);
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!auth.currentUser || auth.currentUser.uid !== 'Vl8iVtOQo9PZrVNKH0zG65yCWv22') {
      setError('Unauthorized access');
      return;
    }

    try {
      const finalTopic = showCustomTopic ? customTopic : topic;

      // Add new topic to public topics if it's custom
      if (showCustomTopic && customTopic) {
        const topicsRef = ref(db, 'public/topics');
        const topicId = customTopic.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        const snapshot = await get(topicsRef);
        const existingTopics = snapshot.val() || {};
        
        if (!Object.values(existingTopics).includes(customTopic)) {
          const updates = { ...existingTopics };
          updates[topicId] = customTopic;
          await set(topicsRef, updates);
          setTopics(prevTopics => {
            const newTopics = [...prevTopics.filter(t => t !== 'Others'), customTopic, 'Others'];
            return newTopics;
          });
        }
      }

      // Add question to public questions
      const questionData = {
        title,
        description,
        examples,
        constraints,
        topic: finalTopic,
        difficulty,
        createdAt: Date.now()
      };

      const questionsRef = ref(db, 'public/questions');
      await push(questionsRef, questionData);

      setSuccess(true);
      // Reset form
      setTitle('');
      setDescription('');
      setExamples('');
      setConstraints('');
      setTopic('');
      setCustomTopic('');
      setShowCustomTopic(false);
      setDifficulty('Easy');
    } catch (error) {
      setError('Failed to add question. Please try again.');
      console.error('Error adding question:', error);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-[#111827]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Add Public Question</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded-lg mb-6">
            Question added successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Topic Selection */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Topic</label>
            <div className="flex flex-wrap gap-3 justify-center">
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTopic(t);
                    if (t === 'Others') {
                      setShowCustomTopic(true);
                    } else {
                      setShowCustomTopic(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-full transition-all duration-300 ${
                    topic === t
                      ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            {/* Custom Topic Input */}
            {showCustomTopic && (
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                placeholder="Enter custom topic..."
              />
            )}
          </div>

          {/* Description */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Description (Markdown)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-[800px] h-[200px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-none"
              placeholder="Enter question description..."
              required
            />
          </div>

          {/* Examples */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Examples (Markdown)</label>
            <textarea
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              required
              className="w-[800px] h-[150px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 font-mono resize-none"
              placeholder="Add example inputs and outputs..."
            />
          </div>

          {/* Constraints */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Constraints (Markdown)</label>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              required
              className="w-[800px] h-[100px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 font-mono resize-none"
              placeholder="Add problem constraints..."
            />
          </div>

          {/* Difficulty Selection */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Difficulty</label>
            <div className="flex gap-3">
              {['Easy', 'Medium', 'Hard'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`px-6 py-2 rounded-full transition-all duration-300 ${
                    difficulty === d
                      ? d.toLowerCase() === 'easy'
                        ? 'bg-green-500/20 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                        : d.toLowerCase() === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                        : 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1"
          >
            Add Public Question
          </button>
        </form>
      </div>
    </div>
  );
}
