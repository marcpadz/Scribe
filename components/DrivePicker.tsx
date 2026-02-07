import React, { useEffect, useState } from 'react';
import { NeoButton, NeoModal, NeoCard } from './NeoUi';
import { searchDriveFiles, DriveFile } from '../services/driveService';
import { Loader2, FileJson, Film, Music, Clock } from 'lucide-react';

interface DrivePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (file: DriveFile) => void;
    accessToken: string;
    mode: 'project' | 'media';
}

export const DrivePicker: React.FC<DrivePickerProps> = ({ isOpen, onClose, onSelect, accessToken, mode }) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && accessToken) {
            loadFiles();
        }
    }, [isOpen, accessToken, mode]);

    const loadFiles = async () => {
        setLoading(true);
        setError('');
        try {
            const results = await searchDriveFiles(accessToken, mode);
            setFiles(results);
        } catch (e) {
            console.error(e);
            setError('Failed to load files from Drive.');
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (mime: string) => {
        if (mime.includes('video')) return <Film size={20} className="text-neo-pink"/>;
        if (mime.includes('audio')) return <Music size={20} className="text-neo-blue"/>;
        return <FileJson size={20} className="text-neo-green"/>;
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <NeoModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={mode === 'project' ? "Open Project from Drive" : "Import Media from Drive"}
        >
            <div className="min-h-[300px] flex flex-col">
                {error && (
                    <div className="bg-neo-pink text-white p-2 mb-4 font-bold border-2 border-black">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <span className="font-mono text-xs uppercase">Connecting to Drive...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {files.length === 0 ? (
                            <div className="text-center py-12 opacity-50 font-mono">
                                No {mode === 'project' ? 'projects' : 'media files'} found.
                            </div>
                        ) : (
                            files.map(file => (
                                <button
                                    key={file.id}
                                    onClick={() => onSelect(file)}
                                    className="w-full text-left p-4 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-zinc-700 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="shrink-0 p-2 bg-white dark:bg-black border border-black dark:border-white shadow-neo-sm dark:shadow-neo-sm-white group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all">
                                            {getIcon(file.mimeType)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold truncate text-sm md:text-base">{file.name.replace('.neoscriber', '')}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                {file.size && <span>{(parseInt(file.size)/1024/1024).toFixed(1)} MB</span>}
                                                {file.modifiedTime && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {formatDate(file.modifiedTime)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <NeoButton variant="secondary" className="scale-75 origin-right opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => {e.stopPropagation(); onSelect(file);}}>
                                        Select
                                    </NeoButton>
                                </button>
                            ))
                        )}
                    </div>
                )}
                
                <div className="mt-4 pt-4 border-t-2 border-black dark:border-white flex justify-between items-center">
                    <span className="text-xs font-mono opacity-50">Google Drive™</span>
                    <NeoButton variant="secondary" onClick={loadFiles} className="text-xs py-1">Refresh</NeoButton>
                </div>
            </div>
        </NeoModal>
    );
};
