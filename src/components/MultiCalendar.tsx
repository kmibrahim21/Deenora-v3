import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Moon, Sun, Flower, X, Loader2, Trash2, Edit2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { Language, CalendarEvent, Institution } from 'types';
import { getBengaliDate, getHijriDate, getEventsForDate } from '../utils/calendarUtils';
import { supabase } from '../supabase';

interface MultiCalendarProps {
  lang: Language;
  institutionId?: string;
  isAdmin?: boolean;
  stacked?: boolean;
  madrasah?: Institution | null;
}

const MultiCalendar: React.FC<MultiCalendarProps> = ({ lang, institutionId, isAdmin, stacked, madrasah }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'en' | 'bn' | 'hj'>('en');

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    if (institutionId) {
      fetchEvents();
    }
  }, [institutionId]);

  const fetchEvents = async () => {
    if (!institutionId) return;
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('institution_id', institutionId);
      
      if (error) {
        console.error('Supabase error fetching events:', error);
        return;
      }

      if (data) {
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventToDelete)
        .eq('institution_id', institutionId);
        
      if (error) throw error;
      fetchEvents();
      setEventToDelete(null);
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderHeader = (title: string, subtitle: string, icon: React.ReactNode, colorClass: string) => {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 px-2 gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${colorClass} rounded-2xl flex items-center justify-center shadow-sm border border-current/10`}>
            {icon}
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {title}
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {!stacked && (
          <div className="flex items-center gap-3">
            <div className={`flex p-1 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <button onClick={prevMonth} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:shadow-sm ${isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-400 hover:bg-white hover:text-[#2563EB]'}`}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className={`px-3 text-[10px] font-black transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-[#2563EB]'}`}>Today</button>
              <button onClick={nextMonth} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:shadow-sm ${isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-400 hover:bg-white hover:text-[#2563EB]'}`}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const dateNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
          {dateNames[i]}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = (type: 'en' | 'bn' | 'hj') => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
          const cellDate = new Date(day);
          const isToday = isSameDay(cellDate, new Date());
          const isCurrentMonth = isSameMonth(cellDate, monthStart);
          const bn = getBengaliDate(cellDate);
          const hj = getHijriDate(cellDate);
          const dayEvents = getEventsForDate(cellDate, events);

          days.push(
            <div
              key={cellDate.toString()}
              onClick={() => {
                if (isAdmin) {
                  setSelectedDate(cellDate);
                  setSelectedEvent(null);
                  setShowEventModal(true);
                }
              }}
              className={`relative h-24 sm:h-28 border flex flex-col items-start justify-start transition-all p-2 cursor-pointer group ${
                !isCurrentMonth ? (isDark ? "bg-slate-900/30 text-slate-700 border-slate-800" : "bg-slate-50/30 text-slate-300 border-slate-50") : 
                isToday ? (isDark ? "bg-blue-900/20 border-blue-900/30" : "bg-blue-50/50 border-slate-50") : (isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700" : "bg-white border-slate-50 hover:bg-slate-50")
              }`}
            >
              <div className="flex justify-between w-full items-start">
                <span className={`text-lg font-black ${isToday ? "text-[#2563EB]" : (isDark ? "text-slate-200" : "text-slate-700")}`}>
                  {type === 'en' ? format(cellDate, "d") : type === 'bn' ? bn.dayBn : hj.dayBn}
                </span>
                <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                  {type !== 'en' && <span className="text-[8px] font-bold text-slate-400">{format(cellDate, "d")}</span>}
                  {type !== 'bn' && <span className={`text-[8px] font-bold font-noto ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{bn.dayBn}</span>}
                  {type !== 'hj' && <span className={`text-[8px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{hj.dayBn}</span>}
                </div>
              </div>
              
              <div className="mt-1 space-y-1 w-full overflow-hidden">
                {dayEvents.slice(0, 3).map((event, idx) => {
                  const eventType = event.event_type || event.type;
                  return (
                    <div 
                      key={idx} 
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded-md truncate ${
                        eventType === 'islamic' ? 'bg-amber-100 text-amber-700' : 
                        eventType === 'holiday' ? 'bg-red-100 text-red-700' : 
                        eventType === 'closed' ? 'bg-slate-200 text-slate-800' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[7px] font-bold text-slate-400 pl-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>

              {isToday && (
                <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-[#2563EB] rounded-full"></div>
              )}
            </div>
          );
          day = addDays(day, 1);
        }
      rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className={`rounded-3xl overflow-hidden border shadow-sm ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>{rows}</div>;
  };

  const renderSingleCalendar = (type: 'en' | 'bn' | 'hj') => {
    let title = "";
    let subtitle = "";
    let icon = null;
    let colorClass = "";

    if (type === 'en') {
      title = format(currentDate, "MMMM yyyy");
      subtitle = "Gregorian Calendar";
      icon = <Sun size={24} />;
      colorClass = "bg-blue-50 text-blue-600";
    } else if (type === 'bn') {
      const bnDate = getBengaliDate(currentDate);
      title = `${bnDate.month.bn} ${bnDate.yearBn}`;
      subtitle = "Bengali Calendar";
      icon = <Flower size={24} />;
      colorClass = "bg-emerald-50 text-emerald-600";
    } else {
      title = `${getHijriDate(currentDate).monthBn} ${getHijriDate(currentDate).yearBn}`;
      subtitle = "Hijri Calendar";
      icon = <Moon size={24} />;
      colorClass = "bg-amber-50 text-amber-600";
    }

    return (
      <div className="space-y-6">
        {renderHeader(title, subtitle, icon, colorClass)}
        {renderDays()}
        {renderCells(type)}
      </div>
    );
  };

  return (
    <div className={`${isDark ? 'bg-slate-900' : 'bg-white'} space-y-10`}>
      {stacked && (
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className={`flex p-1 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button onClick={prevMonth} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-sm ${isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-400 hover:bg-white hover:text-[#2563EB]'}`}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className={`px-5 text-xs font-black transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-[#2563EB]'}`}>Today</button>
            <button onClick={nextMonth} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-sm ${isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-400 hover:bg-white hover:text-[#2563EB]'}`}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {!stacked && (
        <div className={`flex p-2 rounded-[2rem] border max-w-md mx-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <button 
            onClick={() => setActiveTab('en')}
            className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'en' ? (isDark ? 'bg-slate-700 text-blue-400 shadow-premium' : 'bg-white text-[#2563EB] shadow-premium') : 'text-slate-400'}`}
          >
            <Sun size={16} /> English
          </button>
          <button 
            onClick={() => setActiveTab('bn')}
            className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'bn' ? (isDark ? 'bg-slate-700 text-emerald-400 shadow-premium' : 'bg-white text-emerald-600 shadow-premium') : 'text-slate-400'}`}
          >
            <Flower size={16} /> Bengali
          </button>
          <button 
            onClick={() => setActiveTab('hj')}
            className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'hj' ? (isDark ? 'bg-slate-700 text-amber-400 shadow-premium' : 'bg-white text-amber-600 shadow-premium') : 'text-slate-400'}`}
          >
            <Moon size={16} /> Hijri
          </button>
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-20">
        {stacked ? (
          <>
            {renderSingleCalendar('en')}
            <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
            {renderSingleCalendar('bn')}
            <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
            {renderSingleCalendar('hj')}
          </>
        ) : (
          <>
            {activeTab === 'en' && renderSingleCalendar('en')}
            {activeTab === 'bn' && renderSingleCalendar('bn')}
            {activeTab === 'hj' && renderSingleCalendar('hj')}
          </>
        )}
      </div>

      {isAdmin && (
        <div className="flex justify-center">
          <button 
            onClick={() => { setSelectedDate(new Date()); setSelectedEvent(null); setShowEventModal(true); }}
            className="flex items-center gap-3 px-8 py-4 bg-[#2563EB] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 active:scale-95 transition-all"
          >
            <Plus size={20} />
            {lang === 'bn' ? 'ইভেন্ট যোগ করুন' : 'Add Event'}
          </button>
        </div>
      )}

      {showEventModal && selectedDate && (
        <EventModal 
          date={selectedDate} 
          onClose={() => setShowEventModal(false)} 
          onSuccess={() => { fetchEvents(); setShowEventModal(false); }}
          institutionId={institutionId!}
          lang={lang}
          madrasah={madrasah}
          eventToEdit={selectedEvent}
        />
      )}

      {/* Events List */}
      <div className="mt-12">
        <h3 className={`text-lg font-black font-noto mb-6 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
          {lang === 'bn' ? 'ইভেন্ট ও ছুটিসমূহ' : 'Events & Holidays'}
        </h3>
        {events.length > 0 ? (
          <div className="space-y-3">
            {events.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).map(event => {
              const eventType = event.event_type || (event as any).type;
              return (
              <div key={event.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    eventType === 'holiday' ? (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600') :
                    eventType === 'closed' ? (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700') :
                    (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600')
                  }`}>
                    {eventType === 'holiday' ? <CalendarIcon size={18} /> : 
                     eventType === 'closed' ? <Moon size={18} /> : 
                     <Sun size={18} />}
                  </div>
                  <div>
                    <h4 className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{event.title}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      {format(new Date(event.event_date), 'd MMMM yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    eventType === 'holiday' ? (isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700') :
                    eventType === 'closed' ? (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700') :
                    (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700')
                  }`}>
                    {eventType}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setSelectedEvent(event);
                          setSelectedDate(new Date(event.event_date));
                          setShowEventModal(true);
                        }}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
                        title="Edit Event"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setEventToDelete(event.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-red-400' : 'text-slate-400 hover:bg-slate-100 hover:text-red-600'}`}
                        title="Delete Event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className={`text-center py-10 rounded-3xl border border-dashed ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-sm font-bold text-slate-400">
              {lang === 'bn' ? 'কোনো ইভেন্ট পাওয়া যায়নি' : 'No events found'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-[2rem] shadow-2xl border overflow-hidden p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
            <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'bn' ? 'ইভেন্ট মুছুন' : 'Delete Event'}
            </h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এই ইভেন্টটি মুছে ফেলতে চান? এই কাজটি বাতিল করা যাবে না।' : 'Are you sure you want to delete this event? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEventToDelete(null)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteEvent}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200/20"
              >
                {lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EventModal: React.FC<{ 
  date: Date; 
  onClose: () => void; 
  onSuccess: () => void; 
  institutionId: string;
  lang: Language;
  madrasah?: Institution | null;
  eventToEdit?: CalendarEvent | null;
}> = ({ date, onClose, onSuccess, institutionId, lang, madrasah, eventToEdit }) => {
  const [title, setTitle] = useState(eventToEdit?.title || '');
  const [type, setType] = useState<'madrasah' | 'holiday' | 'closed'>(
    (eventToEdit?.event_type as 'madrasah' | 'holiday' | 'closed') || ((eventToEdit as any)?.type as 'madrasah' | 'holiday' | 'closed') || 'madrasah'
  );
  const [loading, setLoading] = useState(false);
  const isDark = madrasah?.theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);
    
    try {
      let error;
      if (eventToEdit) {
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            title,
            event_type: type,
          })
          .eq('id', eventToEdit.id)
          .eq('institution_id', institutionId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            institution_id: institutionId,
            title,
            event_date: format(date, 'yyyy-MM-dd'),
            event_type: type,
            created_at: new Date().toISOString()
          });
        error = insertError;
      }

      if (error) {
        console.error('Supabase error saving event:', error);
        alert('Error saving event: ' + error.message);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving event:', err);
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {eventToEdit ? (lang === 'bn' ? 'ইভেন্ট সম্পাদনা' : 'Edit Event') : (lang === 'bn' ? 'নতুন ইভেন্ট' : 'New Event')}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {format(date, 'd MMMM yyyy')}
              </p>
            </div>
            <button onClick={onClose} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-slate-500 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Event Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter event name..."
                className={`w-full px-6 py-4 border rounded-2xl text-sm font-bold outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-2 focus:ring-blue-500/20'}`}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Event Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setType('madrasah')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${type === 'madrasah' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100')}`}
                >
                  Event
                </button>
                <button 
                  type="button"
                  onClick={() => setType('holiday')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${type === 'holiday' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100')}`}
                >
                  Holiday
                </button>
                <button 
                  type="button"
                  onClick={() => setType('closed')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${type === 'closed' ? 'bg-slate-700 text-white shadow-lg shadow-slate-900' : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100')}`}
                >
                  Closed
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 bg-[#2563EB] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (eventToEdit ? (lang === 'bn' ? 'আপডেট করুন' : 'Update Event') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Event'))}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MultiCalendar;
