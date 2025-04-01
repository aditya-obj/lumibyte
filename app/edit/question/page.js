'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { get, ref, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';

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
  const [questionLink, setQuestionLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [questionId, setQuestionId] = useState(null);
  const [solutions, setSolutions] = useState([{
    title: '',
    code: 'def solution():\n    # Write your solution here\n    pass',
    timeComplexity: '',
    approach: ''
  }]);

  const addSolution = () => {
    setSolutions([...solutions, {
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]);
  };

  const removeSolution = (index) => {
    const newSolutions = solutions.filter((_, i) => i !== index);
    setSolutions(newSolutions.length > 0 ? newSolutions : [{
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]);
  };

  const updateSolution = (index, field, value) => {
    const newSolutions = [...solutions];
    newSolutions[index][field] = value;
    setSolutions(newSolutions);
  };

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
    <div className="min-h-screen p-4 sm:p-8 bg-[#111827] text-gray-200">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Edit Question</h1>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400">
            Question updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-[250px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-gray-900/70
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter question description (markdown supported)..."
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Examples Section */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
            <div className="relative">
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-gray-900/70
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter examples (markdown supported)..."
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Constraints Section */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
            <div className="relative">
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-gray-900/70
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter constraints (markdown supported)..."
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Starter Code Section */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Starter Code</label>
            <div className="rounded-xl overflow-hidden border border-gray-700">
              <Editor
                height="200px"
                defaultLanguage="python"
                value={startCode}
                onChange={setStartCode}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
          </div>

          {/* Solutions Section */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-300">
                  Solutions (Optional)
                </h3>
                <button
                  type="button"
                  onClick={addSolution}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 
                    rounded-xl transition-all duration-300 hover:bg-purple-500/30"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Solution
                </button>
              </div>

              {solutions.map((solution, index) => (
                <div key={index} className="p-6 bg-gray-800/30 rounded-xl border border-gray-700/50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-purple-300">Solution {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeSolution(index)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Solution Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Solution Title <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={solution.title}
                        onChange={(e) => updateSolution(index, 'title', e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                          focus:ring-purple-500/50 transition-all duration-200"
                        placeholder="e.g., Two Pointer Approach"
                        required={!!(solution.code || solution.timeComplexity)}
                      />
                    </div>

                    {/* Time Complexity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Time Complexity <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={solution.timeComplexity}
                        onChange={(e) => updateSolution(index, 'timeComplexity', e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                          focus:ring-purple-500/50 transition-all duration-200"
                        placeholder="e.g., O(n log n)"
                        required={!!(solution.title || solution.code)}
                      />
                    </div>

                    {/* Approach */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Approach (Optional)
                      </label>
                      <div className="relative">
                        <textarea
                          value={solution.approach}
                          onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                          className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                            focus:ring-purple-500/50 focus:border-transparent resize-none
                            transition-all duration-200 hover:bg-gray-900/70
                            hover:border-gray-600 backdrop-blur-sm
                            shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                            hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                          placeholder="Explain your approach (markdown supported)..."
                        />
                        <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                          Markdown supported
                        </div>
                      </div>
                    </div>

                    {/* Solution Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Code <span className="text-red-400">*</span>
                      </label>
                      <div className="rounded-xl overflow-hidden border border-gray-700">
                        <Editor
                          height="300px"
                          defaultLanguage="python"
                          value={solution.code}
                          onChange={(value) => updateSolution(index, 'code', value)}
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-xl 
              font-medium hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 
              hover:-translate-y-0.5"
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
