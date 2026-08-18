import React from 'react';
import { Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { MODELS } from '../services/geminiService';

interface ModelIndicatorProps {
  ready: boolean;
  mediaType?: 'audio' | 'video';
}

/**
 * Visual cue in the main workspace showing which model will process the media.
 * Turns green when the API key is present (app is ready), red when not.
 */
const ModelIndicator: React.FC<ModelIndicatorProps> = ({ ready, mediaType = 'audio' }) => {
  const model = MODELS.transcription;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 border-2 border-black dark:border-white px-3 py-2 rounded-lg shadow-neo-sm bg-neo-yellow dark:bg-neo-dark-card text-black dark:text-white transition-colors ${
        ready ? '' : 'animate-pulse'
      }`}
      title={ready ? 'Ready to process media' : 'API key missing — see .env.local'}
    >
      {ready ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-neo-green" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-500" />
      )}
      <Cpu className="w-4 h-4" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold uppercase tracking-wide">
          {mediaType === 'video' ? 'Video Engine' : 'Audio Engine'}
        </span>
        <span className="text-[11px] opacity-80">{model}</span>
      </div>
      <span
        className={`ml-1 w-2 h-2 rounded-full ${
          ready ? 'bg-green-500 dark:bg-neo-green' : 'bg-red-500'
        }`}
      />
    </div>
  );
};

export default ModelIndicator;