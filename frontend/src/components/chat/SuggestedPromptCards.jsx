import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SuggestedPromptCards = () => {
  const [prompts, setPrompts] = useState([]);
  const navigate = useNavigate();
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API}/ai/suggested-prompts`)
      .then(res => setPrompts(res.data.data || []))
      .catch(() => {});
  }, [API]);

  if (prompts.length === 0) return null;

  const handleClick = (text) => {
    navigate('/chat', { state: { prompt: text } });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mt-8">
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-3 text-center font-medium">
        Coba tanyakan...
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {prompts.map((p) => (
          <button
            key={p.id}
            onClick={() => handleClick(p.text)}
            className="text-left px-4 py-3 rounded-xl border text-sm
              bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100
              dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20
              transition-all duration-200"
          >
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPromptCards;
