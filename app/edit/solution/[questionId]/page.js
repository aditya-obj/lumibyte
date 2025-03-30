'use client';
import { auth, db } from '@/components/firebase.config';
import { ref, get, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import React from 'react';
import { marked } from 'marked';

export default function EditSolution({ params }) {
  const unwrappedParams = React.use(params);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Helper function to safely parse markdown
  const parseMarkdown = (content) => {
    try {
      return marked.parse(content || '');
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return '';
    }
  };

  // Form states
  const [startCode, setStartCode] = useState('def solution():\n    # Write your code here\n    pass');
  const [solutions, setSolutions] = useState([{
    title: '',
    code: 'def solution():\n    # Write your solution here\n    pass',
    timeComplexity: '',
    approach: ''
  }]);

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

    // Validation for solutions (optional, but if present, all fields must be filled)
    if (solutions.length > 0 && !solutions.every(s => 
      s.title.trim() && 
      s.code.trim() && 
      s.timeComplexity.trim() &&
      s.approach.trim()
    )) {
      setError('If adding solutions, all fields (title, code, time complexity, and approach) must be filled');
      return;
    }

    try {
      const updates = {
        [`users/${user.uid}/questions/${unwrappedParams.questionId}/empty_code`]: startCode,
      };

      // Only update solutions if there are any
      if (solutions.length > 0) {
        updates[`users/${user.uid}/questions/${unwrappedParams.questionId}/solutions`] = solutions;
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
    <div className="min-h-screen p-8 flex flex-col items-center bg-[#111827]">
      <div className="w-full max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">
          Edit Solutions for {question?.title}
        </h1>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
            Solutions updated successfully!
          </div>
        )}

        {/* Question Details Section */}
        <div className="glass-container p-6 rounded-xl backdrop-blur-sm space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Question Details</h2>
            
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Description</h3>
              <div className="prose prose-invert max-w-none prose-sm">
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                     dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.description) }} />
              </div>
            </div>

            {/* Examples */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Examples</h3>
              <div className="prose prose-invert max-w-none prose-sm">
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                     dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.examples) }} />
              </div>
            </div>

            {/* Constraints */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Constraints</h3>
              <div className="prose prose-invert max-w-none prose-sm">
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                     dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.constraints) }} />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Starter Code (Required) */}
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
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
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
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
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
                    className="w-full h-[150px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-none"
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
            Update
          </button>
        </form>
      </div>
    </div>
  );
}
