'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { get, ref, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function EditSolution({ params }) {
  const unwrappedParams = React.use(params);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form states
  const [startCode, setStartCode] = useState('');
  const [solutions, setSolutions] = useState([{
    title: '',
    code: '',
    timeComplexity: '',
    approach: ''
  }]);

  // Add these functions
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
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && unwrappedParams.questionId) {
      const fetchQuestion = async () => {
        try {
          const questionRef = ref(db, `users/${user.uid}/questions/${unwrappedParams.questionId}`);
          const snapshot = await get(questionRef);
          
          if (snapshot.exists()) {
            const questionData = snapshot.val();
            setQuestion(questionData);
            
            // Pre-fill the form with existing data
            if (questionData.empty_code) {
              setStartCode(questionData.empty_code);
            }
            if (questionData.solutions) {
              setSolutions(questionData.solutions);
            }
          }
        } catch (error) {
          console.error('Error fetching question:', error);
          setError('Failed to load question data');
        } finally {
          setIsLoading(false);
        }
      };

      fetchQuestion();
    }
  }, [user, unwrappedParams.questionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation for empty_code (required)
    if (!startCode.trim()) {
      setError('Starter code is required');
      return;
    }

    // Validation for solutions (title, code, and timeComplexity are required if any is filled)
    const hasIncompleteSolution = solutions.some(s => 
      (s.title || s.code || s.timeComplexity) && 
      (!s.title.trim() || !s.code.trim() || !s.timeComplexity.trim())
    );

    if (hasIncompleteSolution) {
      setError('Please fill all required fields for each solution (title, code, and time complexity) or remove incomplete solutions');
      return;
    }

    try {
      const updates = {
        [`users/${user.uid}/questions/${unwrappedParams.questionId}/empty_code`]: startCode,
      };

      // Only update solutions if there are any non-empty solutions
      const nonEmptySolutions = solutions.filter(s => 
        s.title.trim() || s.code.trim() || s.timeComplexity.trim()
      );

      if (nonEmptySolutions.length > 0) {
        updates[`users/${user.uid}/questions/${unwrappedParams.questionId}/solutions`] = nonEmptySolutions;
      } else {
        // If no solutions, remove the solutions field from database
        updates[`users/${user.uid}/questions/${unwrappedParams.questionId}/solutions`] = null;
      }

      await update(ref(db), updates);
      setSuccess(true);
      router.push('/edit/solutions');
    } catch (err) {
      setError('Failed to update solutions. Please try again.');
      console.error('Error updating solutions:', err);
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
    <div className="min-h-screen p-8 bg-[#111827] text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">
          Edit Solution: <span className="text-purple-400">{question?.title}</span>
        </h1>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400">
            Solutions updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question Details (Readonly) */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
            <input
              type="text"
              value={question?.title || ''}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                text-gray-100 focus:outline-none cursor-not-allowed opacity-70"
              readOnly
            />
          </div>

          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Question Link</label>
            <input
              type="text"
              value={question?.questionLink || ''}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                text-gray-100 focus:outline-none cursor-not-allowed opacity-70"
              readOnly
            />
          </div>

          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Topic</label>
            <input
              type="text"
              value={question?.topic || ''}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                text-gray-100 focus:outline-none cursor-not-allowed opacity-70"
              readOnly
            />
          </div>

          {/* Description */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={question?.description || ''}
                className="w-full h-[250px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
            <div className="relative">
              <textarea
                value={question?.examples || ''}
                className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
            <div className="relative">
              <textarea
                value={question?.constraints || ''}
                className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Starter Code */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Starter Code <span className="text-red-400">*</span>
            </label>
            <div className="rounded-xl overflow-hidden border border-gray-700">
              <Editor
                height="250px"
                defaultLanguage="python"
                value={startCode}
                onChange={setStartCode}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'gutter',
                }}
              />
            </div>
          </div>

          {/* Solutions */}
          <div className="space-y-6">
            {solutions.map((solution, index) => (
              <div key={index} className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={solution.title}
                      onChange={(e) => updateSolution(index, 'title', e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                        text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                        focus:ring-purple-500/50 focus:border-transparent"
                      placeholder="e.g., Optimal Solution"
                      required
                    />
                  </div>
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
                        focus:ring-purple-500/50 focus:border-transparent"
                      placeholder="e.g., O(n log n)"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Approach (Optional)
                  </label>
                  <div className="relative">
                    <textarea
                      value={solution.approach}
                      onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                      className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                        text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                        focus:ring-purple-500/50 focus:border-transparent resize-none"
                      placeholder="Explain your approach (markdown supported)..."
                    />
                    <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                      Markdown supported
                    </div>
                  </div>
                </div>

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
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        renderLineHighlight: 'gutter',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={addSolution}
              className="px-6 py-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/50 
                hover:bg-purple-500/20 transition-colors"
            >
              Add Solution
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 
                transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Note: Custom scrollbar styles in globals.css are used by the left column and textareas
