'use client';

export default function ConfirmationDialog({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 px-6 py-6 text-left shadow-xl transition-all w-full max-w-lg">
          {/* Icon and Title */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {title}
              </h3>
              <p className="mt-2 text-gray-300">
                {message}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-8 flex gap-3 justify-end">
            <button
              type="button"
              className="inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-gray-300 
                hover:text-white bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 
                transition-all duration-200 ease-in-out"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-red-300 
                hover:text-red-200 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 
                hover:border-red-500/50 transition-all duration-200 ease-in-out"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}