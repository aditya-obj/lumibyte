'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { get, ref, update } from 'firebase/database';
import { marked } from 'marked';
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
  const [startCode, setStartCode] = useState('');
  const [solutions, setSolutions] = useState([{
    title: '',
    code: '',
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
    <div className="min-h-screen p-4 sm:p-8 bg-[#111827] text-gray-200"> {/* Solid background */}
      <div className="w-full max-w-7xl mx-auto space-y-8"> 
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-white">
          Edit Solution: <span className="text-purple-400">{question?.title}</span>
        </h1>

        {error && (
          <div className="p-4 bg-red-900/40 border border-red-600/50 rounded-lg text-red-300"> {/* Adjusted error style */}
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-900/40 border border-green-600/50 rounded-lg text-green-300"> {/* Adjusted success style */}
            Solutions updated successfully!
          </div>
        )}

        {/* Main Content Grid (Re-introduced 2 columns on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Question Details */}
          {/* Removed lg:sticky lg:top-8 to prevent scroll conflicts */}
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/60 space-y-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto custom-scrollbar"> 
            <h2 className="text-2xl font-semibold text-white mb-4 border-b border-gray-700 pb-3">
              Question Details
            </h2>
            
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-300 mb-2">Description</h3>
              <div className="prose prose-invert max-w-none prose-base bg-gray-900/60 rounded-lg border border-gray-700 p-4">
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.description) }} />
              </div>
            </div>

            {/* Examples */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-300 mb-2">Examples</h3>
              <div className="prose prose-invert max-w-none prose-base bg-gray-900/60 rounded-lg border border-gray-700 p-4">
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.examples) }} />
              </div>
            </div>

            {/* Constraints */}
            <div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Constraints</h3>
              <div className="prose prose-invert max-w-none prose-base bg-gray-900/60 rounded-lg border border-gray-700 p-4">
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(question?.constraints) }} />
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Starter Code (Required) */}
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/60">
              <label className="block text-xl font-semibold mb-4 text-gray-200"> {/* Larger label */}
                Starter Code <span className="text-red-400">*</span>
              </label>
              <div className="rounded-lg overflow-hidden border border-gray-600"> {/* Slightly lighter border */}
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
                    lineNumbers: 'on', // Ensure line numbers are visible
                    renderLineHighlight: 'gutter',
                  }}
                />
              </div>
            </div>

            {/* Solutions Section */}
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/60">
              <div className="flex items-center justify-between mb-6"> {/* Increased bottom margin */}
                <label className="block text-xl font-semibold text-gray-200">Solutions</label>
                <button
                  type="button"
                  onClick={() => setSolutions([...solutions, { title: '', code: '', timeComplexity: '', approach: '' }])}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white transition-colors duration-200 hover:bg-emerald-500 text-sm font-medium shadow-md cursor-pointer" /* Added cursor-pointer */
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  Add Solution
                </button>
              </div>

              {/* Solution Cards */}
              <div className="space-y-6"> {/* Added space between solution cards */}
                {solutions.map((solution, index) => (
                  <div key={index} className="p-5 bg-gray-900/60 rounded-xl border border-gray-700 relative group"> {/* Darker card bg */}
                    {/* Delete Button */}
                    {solutions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (solutions.length === 1 && !solution.title && !solution.code && !solution.timeComplexity && !solution.approach) return;
                          const newSolutions = solutions.filter((_, i) => i !== index);
                          setSolutions(newSolutions.length > 0 ? newSolutions : [{ title: '', code: '', timeComplexity: '', approach: '' }]);
                        }}
                        className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-gray-700/50 opacity-50 group-hover:opacity-100 focus:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" /* Added cursor-pointer */
                        aria-label="Remove Solution"
                        disabled={solutions.length === 1 && !solution.title && !solution.code && !solution.timeComplexity && !solution.approach}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    <h3 className="text-lg font-semibold text-purple-300 mb-5">Solution {index + 1}</h3> {/* Increased bottom margin */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5"> {/* Increased gap and margin */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-300">Title <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={solution.title}
                          onChange={(e) => {
                            const newSolutions = [...solutions];
                            newSolutions[index].title = e.target.value;
                            setSolutions(newSolutions);
                          }}
                          className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-gray-500 text-gray-200 text-sm" /* Adjusted input style */
                          placeholder="e.g., Optimal Approach"
                          required={!!(solution.code || solution.timeComplexity)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-300">Time Complexity <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={solution.timeComplexity}
                          onChange={(e) => {
                            const newSolutions = [...solutions];
                            newSolutions[index].timeComplexity = e.target.value;
                            setSolutions(newSolutions);
                          }}
                          className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-gray-500 text-gray-200 text-sm" /* Adjusted input style */
                          placeholder="e.g., O(n log n)"
                          required={!!(solution.title || solution.code)}
                        />
                      </div>
                    </div>

                    <div className="mb-5"> {/* Increased margin */}
                      <label className="block text-sm font-medium mb-1.5 text-gray-300">
                        Approach (Optional)
                      </label>
                      <textarea
                        value={solution.approach}
                        onChange={(e) => {
                          const newSolutions = [...solutions];
                          newSolutions[index].approach = e.target.value;
                          setSolutions(newSolutions);
                        }}
                        className="w-full h-[120px] px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-y placeholder-gray-500 text-gray-200 custom-scrollbar text-sm" /* Adjusted textarea style */
                        placeholder="Explain your approach (markdown supported)..."
                      />
                       {solution.approach && (
                         <div className="mt-3 text-xs text-gray-400"> {/* Increased top margin */}
                           <span className="font-semibold">Preview:</span>
                           <div className="prose prose-invert prose-sm max-w-none mt-1 p-3 border border-dashed border-gray-600 rounded bg-gray-800/50" /* Adjusted preview style */
                                dangerouslySetInnerHTML={{ __html: parseMarkdown(solution.approach) }} />
                         </div>
                       )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-gray-300">Code <span className="text-red-400">*</span></label>
                      <div className="h-[300px] rounded-lg overflow-hidden border border-gray-600">
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
              </div> {/* End Solution Cards container */}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3.5 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:from-blue-700 hover:to-purple-700 hover:-translate-y-0.5 text-lg font-semibold shadow-lg cursor-pointer" /* Added cursor-pointer */
            >
              Update Solution
            </button>
          </form>
        </div> {/* End Main Content Grid */}
      </div>
    </div>
  );
}

// Note: Custom scrollbar styles in globals.css are used by the left column and textareas
