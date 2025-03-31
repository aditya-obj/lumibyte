'use client';
import { useState, useEffect, Suspense } from 'react';
import { auth, db } from '@/components/firebase.config';
import { ref, get, update } from 'firebase/database';
import Editor from '@monaco-editor/react';
import { useRouter, useSearchParams } from 'next/navigation';

const createSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Create a wrapper component for the search params functionality
function EditQuestionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState(['Others']);
  const [difficulty, setDifficulty] = useState('Easy');
  const [startCode, setStartCode] = useState('def solution():\n    # Write your code here\n    pass');
  const [solutions, setSolutions] = useState([{
    title: '',
    code: 'def solution():\n    # Write your solution here\n    pass',
    timeComplexity: '',
    approach: ''
  }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [questionId, setQuestionId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        // Fetch topics
        const topicsRef = ref(db, `users/${user.uid}/topics`);
        get(topicsRef).then((snapshot) => {
          if (snapshot.exists()) {
            const topicsData = Object.values(snapshot.val());
            setTopics([...topicsData, 'Others']);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchQuestion = async () => {
      if (!user) return;

      const params = new URLSearchParams(window.location.search);
      const questionId = params.get('id');
      if (!questionId) {
        router.push('/');
        return;
      }

      setQuestionId(questionId);
      const questionRef = ref(db, `users/${user.uid}/questions/${questionId}`);

      try {
        const snapshot = await get(questionRef);
        if (snapshot.exists()) {
          const questionData = snapshot.val();
          setTitle(questionData.title || '');
          setDescription(questionData.description || '');
          setExamples(questionData.examples || '');
          setConstraints(questionData.constraints || '');
          setTopic(questionData.topic || '');
          setDifficulty(questionData.difficulty || 'Easy');
          setStartCode(questionData.empty_code || 'def solution():\n    # Write your code here\n    pass');
          setSolutions(questionData.solutions || [{
            title: '',
            code: 'def solution():\n    # Write your solution here\n    pass',
            timeComplexity: '',
            approach: ''
          }]);
        }
      } catch (error) {
        console.error('Error fetching question:', error);
        setError('Failed to load question data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestion();
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!auth.currentUser) {
      setError('Please login to update questions');
      return;
    }

    if (!title || !description || !topic) {
      setError('Title, description, and topic are required');
      return;
    }

    try {
      const questionData = {
        title,
        description,
        examples,
        constraints,
        topic: showCustomTopic ? customTopic : topic,
        difficulty,
        empty_code: startCode,
        solutions: solutions.length > 0 ? solutions : null,
        updatedAt: Date.now()
      };

      const questionRef = ref(db, `users/${user.uid}/questions/${questionId}`);
      await update(questionRef, questionData);

      setSuccess(true);
      router.push(`/${createSlug(topic)}/${createSlug(title)}`);
    } catch (error) {
      setError('Failed to update question. Please try again.');
      console.error('Error updating question:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-center bg-[#111827]">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-[#111827]">
      {/* Header with Back Button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-white">Edit Question</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-500">
            Question updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter question title..."
              required
            />
          </div>

          {/* Description Input */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-48 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter question description..."
              required
            />
          </div>

          {/* Examples Input */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Examples
            </label>
            <textarea
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              className="w-full h-32 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter examples..."
            />
          </div>

          {/* Constraints Input */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Constraints
            </label>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="w-full h-32 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter constraints..."
            />
          </div>

          {/* Topic and Difficulty Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Topic <span className="text-red-500">*</span>
              </label>
              <select
                value={topic}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    setShowCustomTopic(true);
                    setTopic('');
                  } else {
                    setShowCustomTopic(false);
                    setTopic(value);
                  }
                }}
                className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="">Select a topic</option>
                {topics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="custom">Add Custom Topic</option>
              </select>
              {showCustomTopic && (
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="mt-2 w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter custom topic..."
                  required
                />
              )}
            </div>

            <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Difficulty <span className="text-red-500">*</span>
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Starter Code */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Starter Code <span className="text-red-500">*</span>
            </label>
            <Editor
              height="200px"
              defaultLanguage="python"
              value={startCode}
              onChange={setStartCode}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
              }}
              className="rounded-lg overflow-hidden"
            />
          </div>

          {/* Solutions (Optional) */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-300">Solutions</label>
              <button
                type="button"
                onClick={() => setSolutions([...solutions, {
                  title: '',
                  code: '',
                  timeComplexity: '',
                  approach: ''
                }])}
                className="glass-button bg-gradient-to-r from-green-400 to-emerald-500 text-white w-8 h-8 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:-translate-y-1 flex items-center justify-center text-xl"
              >
                +
              </button>
            </div>

            {solutions.map((solution, index) => (
              <div key={index} className="mb-8 p-6 bg-gray-800/30 rounded-xl">
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newSolutions = solutions.filter((_, i) => i !== index);
                      setSolutions(newSolutions);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Title</label>
                    <input
                      type="text"
                      value={solution.title}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].title = e.target.value;
                        setSolutions(newSolutions);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Solution title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Time Complexity</label>
                    <input
                      type="text"
                      value={solution.timeComplexity}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].timeComplexity = e.target.value;
                        setSolutions(newSolutions);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., O(n)"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Approach
                  </label>
                  <textarea
                    value={solution.approach}
                    onChange={(e) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].approach = e.target.value;
                      setSolutions(newSolutions);
                    }}
                    className="w-full h-[150px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Explain your approach..."
                  />
                </div>

                <div className="h-[300px] rounded-lg overflow-hidden">
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    value={solution.code}
                    onChange={(value) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].code = value;
                      setSolutions(newSolutions);
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1"
          >
            Update Question
          </button>
        </form>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function EditQuestionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-8 flex justify-center items-center bg-[#111827]">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full"></div>
      </div>
    }>
      <EditQuestionContent />
    </Suspense>
  );
}
