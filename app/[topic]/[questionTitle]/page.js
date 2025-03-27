'use client';
import { useState, useEffect } from 'react';
import React from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';

import { auth, db } from '@/components/firebase.config';
import { ref, get } from 'firebase/database';

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

export default function QuestionPage({ params }) {
  const unwrappedParams = React.use(params);
  const [showSolution, setShowSolution] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [question, setQuestion] = useState(null);
  const [userSolutions, setUserSolutions] = useState([{ code: '', timeComplexity: '' }]);
  const [activeUserSolution, setActiveUserSolution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (question) {
      setUserSolutions([{ code: question.empty_code, timeComplexity: '' }]);
    }
  }, [question]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchQuestion = async () => {
      if (user && unwrappedParams) {
        const questionsRef = ref(db, `users/${user.uid}/questions`);
        const snapshot = await get(questionsRef);
        if (snapshot.exists()) {
          let foundQuestion = null;
          snapshot.forEach((childSnapshot) => {
            const q = childSnapshot.val();
            if (createSlug(q.topic) === unwrappedParams.topic && 
                createSlug(q.title) === unwrappedParams.questionTitle) {
              foundQuestion = {
                id: childSnapshot.key,
                ...q
              };
            }
          });
          setQuestion(foundQuestion);
        }
      }
      setLoading(false);
    };

    fetchQuestion();
  }, [user, unwrappedParams]);

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>;
  }

  if (!question) {
    return <div className="min-h-screen p-8">Question not found</div>;
  }

  return (
    <div className="min-h-screen p-8 transition-colors">
      <h1 className="text-3xl font-bold mb-4">{question.title}</h1>
      
      <div className="prose prose-invert max-w-none mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <div dangerouslySetInnerHTML={{ __html: marked(question.description) }} />
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Examples</h2>
          <div dangerouslySetInnerHTML={{ __html: marked(question.examples) }} />
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Constraints</h2>
          <div dangerouslySetInnerHTML={{ __html: marked(question.constraints) }} />
        </div>
      </div>

      <div className="text-secondary mb-8">
        <span className="mr-6">Topic: {question.topic}</span>
        <span className={`px-3 py-1 rounded ${question.difficulty.toLowerCase() === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : question.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
          {question.difficulty}
        </span>
      </div>
      
      <div className="mb-8">
        <button 
          onClick={() => setShowSolution(!showSolution)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg transition-colors"
        >
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Your Solutions</h2>
            <button
              onClick={() => setUserSolutions([...userSolutions, { code: question.empty_code, timeComplexity: '' }])}
              className="bg-accent hover:bg-accent-hover text-white px-3 py-1 rounded-lg transition-colors text-xl"
            >
              +
            </button>
          </div>
          <div className="flex border-b border-gray-700 mb-4 overflow-x-auto">
            {userSolutions.map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-4 py-2 font-medium whitespace-nowrap relative group"
              >
                <span
                  onClick={() => setActiveUserSolution(index)}
                  className={`cursor-pointer ${activeUserSolution === index ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Solution {index + 1}
                </span>
                {userSolutions.length > 1 && (
                  <button
                    onClick={() => {
                      const newSolutions = userSolutions.filter((_, i) => i !== index);
                      setUserSolutions(newSolutions);
                      if (activeUserSolution >= newSolutions.length) {
                        setActiveUserSolution(newSolutions.length - 1);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="h-[500px] rounded-lg overflow-hidden shadow-sm mb-4">
            <Editor
              height="100%"
              defaultValue={question.empty_code}
              language="python"
              theme="vs-dark"
              options={{
                beforeMount: (monaco) => {
                  monaco.editor.defineTheme('protected-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                      { token: 'protected', foreground: '6A9955', fontStyle: 'italic' }
                    ],
                    colors: {
                      'editor.background': '#0F0F0F'
                    }
                  });
                },
                onMount: (editor, monaco) => {
                  const model = editor.getModel();
                  const decorations = model.deltaDecorations([], [
                    {
                      range: new monaco.Range(1, 1, 2, 1),
                      options: {
                        isWholeLine: true,
                        inlineClassName: 'protected',
                        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                      }
                    }
                  ]);
                  editor.onDidChangeModelContent((e) => {
                    const value = model.getValue();
                    const lines = value.split('\n');
                    const originalLines = question.empty_code.split('\n');
                    
                    // Ensure the first two lines match the template
                    if (lines[0] !== originalLines[0] || lines[1] !== originalLines[1]) {
                      const preservedContent = lines.length > 2 ? lines.slice(2).join('\n') : '';
                      model.pushEditOperations(
                        [],
                        [{
                          range: model.getFullModelRange(),
                          text: originalLines[0] + '\n' + originalLines[1] + (preservedContent ? '\n' + preservedContent : '')
                        }],
                        () => null
                      );
                    }
                    
                    // Prevent cursor from moving to protected area
                    const position = editor.getPosition();
                    if (position.lineNumber <= 2) {
                      editor.setPosition({ lineNumber: 3, column: 1 });
                    }
                    
                    // Add read-only decorations to first two lines
                    model.deltaDecorations([], [
                      {
                        range: new monaco.Range(1, 1, 2, 1),
                        options: {
                          isWholeLine: true,
                          inlineClassName: 'protected',
                          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                          readOnly: true
                        }
                      }
                    ]);
                  });
                  
                },
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, 'Courier New', monospace",
                fontLigatures: true,
                tabSize: 4,
                insertSpaces: true,
                autoIndent: 'full',
                formatOnPaste: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordBasedSuggestions: true,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                  verticalScrollbarSize: 0,
                  horizontalScrollbarSize: 0,
                  useShadows: true
                },
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                lineNumbersMinChars: 3,
                renderLineHighlight: 'all',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: true,
                roundedSelection: true,
                contextmenu: true,
                mouseWheelZoom: true,
                bracketPairColorization: { enabled: true },
                theme: {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#0F0F0F'
                  }
                }
              }}
              className="rounded-lg shadow-lg border border-gray-700"
              onChange={(value) => {
                const updatedSolutions = [...userSolutions];
                updatedSolutions[activeUserSolution].code = value;
                setUserSolutions(updatedSolutions);
              }}
              value={userSolutions[activeUserSolution].code}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Time Complexity</label>
              <input
                type="text"
                value={userSolutions[activeUserSolution].timeComplexity}
                onChange={(e) => {
                  const updatedSolutions = [...userSolutions];
                  updatedSolutions[activeUserSolution].timeComplexity = e.target.value;
                  setUserSolutions(updatedSolutions);
                }}
                placeholder="e.g., O(n)"
                className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-code-bg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

          </div>
        </div>

        {showSolution && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Solutions</h2>
            <div className="flex border-b border-gray-700 mb-4">
              {question.solutions.map((solution, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`px-4 py-2 font-medium ${activeTab === index ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  {solution.title}
                </button>
              ))}
            </div>
            {question.solutions.map((solution, index) => (
              <div key={index} className={`${activeTab === index ? 'block' : 'hidden'}`}>
                {solution.timeComplexity && (
                  <div className="mb-4">
                    <span className="text-secondary bg-code-bg px-3 py-1 rounded">
                      Time Complexity: {solution.timeComplexity}
                    </span>
                  </div>
                )}
                <div className="h-[300px] rounded-lg overflow-hidden shadow-sm mb-4">
                  <Editor
                    height="100%"
                    value={solution.code}
                    language="python"
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      padding: { top: 12, bottom: 12 }
                    }}
                  />
                </div>
                {solution.approach && (
                  <div className="mt-4 p-4 bg-code-bg rounded-lg">
                    <h3 className="text-lg font-medium mb-2">Approach</h3>
                    <div className="prose prose-invert" dangerouslySetInnerHTML={{ __html: marked(solution.approach) }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}