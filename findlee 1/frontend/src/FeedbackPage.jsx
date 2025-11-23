import React, { useState } from 'react';

export default function FeedbackPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const stars = [1, 2, 3, 4, 5];

  function validate() {
    if (!message.trim()) return 'Please write a message.';
    if (rating < 1 || rating > 5) return 'Please give a rating between 1 and 5.';
    return '';
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const subject = encodeURIComponent(`Feedback from ${name || 'Anonymous'}`);
    const bodyLines = [];
    bodyLines.push(`Name: ${name || 'Anonymous'}`);
    bodyLines.push(`Rating: ${rating}/5`);
    bodyLines.push('');
    bodyLines.push(message);
    const body = encodeURIComponent(bodyLines.join('\n'));

    const mailto = `mailto:findly.web@gmail.com?subject=${subject}&body=${body}`;

    window.location.href = mailto;
    setTimeout(() => setSubmitting(false), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-gradient-to-br from-gray-50 via-indigo-100 to-purple-200 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 transition-colors duration-500">
      <div className="w-full max-w-2xl p-8 rounded-3xl shadow-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 text-white">
        <h1 className="text-3xl font-bold mb-3 text-center">Share Your Feedback</h1>
        <p className="text-center text-sm mb-8 opacity-90">We’d love to hear what you think — every opinion helps us improve.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl px-4 py-2 bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your feedback here..."
              rows={6}
              className="w-full rounded-xl px-4 py-3 bg-white/20 text-white placeholder-white/70 resize-vertical focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex items-center space-x-3">
              {stars.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  aria-label={`${s} star`}
                  className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                    s <= rating ? 'bg-pink-400 text-white' : 'bg-white/20 text-white/70'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.176c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.286 3.966c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.78 2.703c-.784.57-1.84-.197-1.54-1.118l1.286-3.966a1 1 0 00-.364-1.118L2.222 9.393c-.783-.57-.38-1.81.588-1.81h4.176a1 1 0 00.95-.69L9.05 2.927z" />
                  </svg>
                </button>
              ))}
              <div className="ml-3 text-sm opacity-90">{rating}/5</div>
            </div>
          </div>

          {error && <div className="text-pink-200 text-sm">{error}</div>}

          <div className="flex justify-center space-x-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-white text-indigo-700 font-semibold px-6 py-2 rounded-xl hover:scale-105 transform transition-all disabled:opacity-60"
            >
              {submitting ? 'Opening mail...' : 'Send Feedback'}
            </button>

            <button
              type="button"
              onClick={() => {
                setName('');
                setMessage('');
                setRating(0);
                setError('');
              }}
              className="border border-white/40 text-white font-medium px-5 py-2 rounded-xl hover:bg-white/20 transition-all"
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-center opacity-70 mt-4">
            This opens your mail client to send the email to <span className="font-medium">findly.web@gmail.com</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
