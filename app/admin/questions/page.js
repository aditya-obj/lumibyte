'use client';
import { auth, db } from '@/components/firebase.config';
import { get, push, ref, set } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  const [questionLink, setQuestionLink] = useState('');
  const router = useRouter();

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
        createdAt: Date.now(),
        questionLink
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
      setQuestionLink('');
    } catch (error) {
      setError('Failed to add question. Please try again.');
      console.error('Error adding question:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0f172a] to-gray-900">
      {/* Animated background gradients */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] top-1/4 -left-24 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute w-[400px] h-[400px] bottom-0 right-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="back-button-container">
              <button
                onClick={() => router.back()}
                className="universal-back-button"
                aria-label="Go back"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth={2} 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                <span>Back</span>
              </button>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                Create New Question
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-400">
                Add a new coding challenge to the public question bank
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 mb-8">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm animate-slideDown">
              <div className="flex items-center gap-3 text-red-400">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 backdrop-blur-sm animate-slideDown">
              <div className="flex items-center gap-3 text-emerald-400">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Question added successfully!</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[2fr,1fr] gap-6">
          {/* Left Column - Main Content */}
          <div className="space-y-6">
            {/* Title & Topic Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6 space-y-6">
                {/* Title Input */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 
                      placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 
                      focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
                    placeholder="Enter a descriptive title..."
                    required
                  />
                </div>

                {/* Question Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Question Link</label>
                  <input
                    type="url"
                    value={questionLink}
                    onChange={(e) => setQuestionLink(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 
                      placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 
                      focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
                    placeholder="Enter the question link (e.g., LeetCode, HackerRank)..."
                  />
                </div>

                {/* Topic Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Topic</label>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTopic(t);
                          setShowCustomTopic(t === 'Others');
                        }}
                        className={`
                          px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                          ${topic === t 
                            ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                            : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                          }
                        `}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  
                  {showCustomTopic && (
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="mt-4 w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                        text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                        focus:ring-purple-500/50 transition-all duration-200 hover:bg-gray-900/70"
                      placeholder="Enter custom topic..."
                    />
                  )}
                </div>

                {/* Difficulty Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Difficulty</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Easy', 'Medium', 'Hard'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`
                          py-3 rounded-xl text-sm font-medium transition-all duration-300
                          ${difficulty === d
                            ? d === 'Easy'
                              ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                              : d === 'Medium'
                              ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50'
                              : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                            : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                          }
                        `}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-[300px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                      text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
                    placeholder="Write your question description using Markdown..."
                    required
                  />
                  <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-6">
            {/* Examples Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
                <div className="relative">
                  <textarea
                    value={examples}
                    onChange={(e) => setExamples(e.target.value)}
                    className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                      text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
                    placeholder="Input: nums = [1, 2, 3]&#10;Output: [1, 2, 3]&#10;Explanation: Example details..."
                    required
                  />
                  <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>

            {/* Constraints Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
                <div className="relative">
                  <textarea
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                      text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
                    placeholder="• 1 <= nums.length <= 10^5&#10;• -10^9 <= nums[i] <= 10^9"
                    required
                  />
                  <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 
                text-white py-4 rounded-xl font-medium transition-all duration-300 
                hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] focus:outline-none 
                focus:ring-2 focus:ring-purple-500/50 hover:scale-[1.02]"
            >
              Create Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
