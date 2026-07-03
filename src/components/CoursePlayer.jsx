import React, { useState } from 'react';

export default function CoursePlayer({ courseId, initialLessons }) {
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [completed, setCompleted] = useState(new Set());

    const lessons = initialLessons || [
        { id: 1, title: "Pengantar Fiqih Wakaf", youtubeId: "dQw4w9WgXcQ" },
        { id: 2, title: "Regulasi BWI", youtubeId: "M7lc1UVf-VE" }
    ];

    const currentLesson = lessons[currentLessonIndex];

    const toggleCompletion = (id) => {
        const newSet = new Set(completed);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setCompleted(newSet);
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50">
            {/* Main Content Area (Video) */}
            <div className="flex-1 flex flex-col h-[60vh] md:h-screen">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <a href={`/academy/${courseId}`} className="text-slate-300 hover:text-white">← Keluar</a>
                    <h1 className="font-semibold truncate px-4">{currentLesson.title}</h1>
                </div>
                
                <div className="flex-1 bg-black w-full relative">
                    <iframe 
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${currentLesson.youtubeId}?rel=0`} 
                        title="Course Video Player" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>

                <div className="p-6 bg-white border-t border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentLesson.title}</h2>
                    <p className="text-slate-600 mb-6">Tonton video hingga selesai sebelum menandai modul ini selesai.</p>
                    
                    <button 
                        onClick={() => toggleCompletion(currentLesson.id)}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                            completed.has(currentLesson.id) 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {completed.has(currentLesson.id) ? '✓ Modul Selesai' : 'Tandai Selesai'}
                    </button>
                </div>
            </div>

            {/* Sidebar (Playlist/Lessons) */}
            <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col h-auto md:h-screen overflow-y-auto">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Daftar Materi</h3>
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                        <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all" 
                            style={{ width: `${(completed.size / lessons.length) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{completed.size} dari {lessons.length} selesai</p>
                </div>

                <div className="divide-y divide-slate-100">
                    {lessons.map((lesson, idx) => (
                        <button 
                            key={lesson.id}
                            onClick={() => setCurrentLessonIndex(idx)}
                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                                currentLessonIndex === idx ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                            }`}
                        >
                            <div className="mt-1">
                                {completed.has(lesson.id) 
                                    ? <span className="text-emerald-500 text-lg">✓</span>
                                    : <span className="text-slate-300 text-lg">○</span>
                                }
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-400">Modul {idx + 1}</span>
                                <h4 className={`text-sm font-medium ${currentLessonIndex === idx ? 'text-blue-900' : 'text-slate-700'}`}>
                                    {lesson.title}
                                </h4>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
