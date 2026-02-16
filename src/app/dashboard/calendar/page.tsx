'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Event, EventType } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isToday, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Search, Calendar as CalendarIcon, LayoutGrid, List, MapPin, Clock, Filter, SortAsc } from 'lucide-react';

type ViewMode = 'month' | 'week' | 'day';
type SortMode = 'date' | 'title' | 'type';

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showEventDetail, setShowEventDetail] = useState<Event | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'work' as EventType,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    category: 'general',
  });

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, selectedDate]);

  const loadEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Event;
      });
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

      const eventData = {
        userId: user.uid,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        startDate: Timestamp.fromDate(startDateTime),
        endDate: Timestamp.fromDate(endDateTime),
        location: formData.location,
        category: formData.category,
        updatedAt: Timestamp.now(),
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      loadEvents();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      await deleteDoc(doc(db, 'events', eventId));
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      type: event.type,
      startDate: format(event.startDate, 'yyyy-MM-dd'),
      startTime: format(event.startDate, 'HH:mm'),
      endDate: format(event.endDate, 'yyyy-MM-dd'),
      endTime: format(event.endDate, 'HH:mm'),
      location: event.location || '',
      category: event.category,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'work',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      location: '',
      category: 'general',
    });
    setEditingEvent(null);
    setShowModal(false);
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return eachDayOfInterval({ start, end });
  };

  const getDaysInWeek = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Lunes
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(event.startDate, day));
  };

  // Filtrar y ordenar eventos
  const getFilteredAndSortedEvents = () => {
    let filtered = events;

    // Filtrar por búsqueda
    if (searchQuery) {
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtrar por tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }

    // Ordenar
    switch (sortMode) {
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'type':
        filtered.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'date':
      default:
        filtered.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }

    return filtered;
  };

  const filteredEvents = getFilteredAndSortedEvents();
  const todayEvents = getEventsForDay(new Date());
  const daysInMonth = getDaysInMonth();
  const daysInWeek = getDaysInWeek();

  const getEventTypeColor = (type: EventType) => {
    switch (type) {
      case 'work': return 'bg-brand-blue/20 border-brand-navy text-brand-navy';
      case 'personal': return 'bg-green-100 border-green-500 text-green-700';
      case 'meeting': return 'bg-brand-orange/15 border-brand-orange text-brand-orange';
      case 'reminder': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getEventTypeName = (type: EventType) => {
    switch (type) {
      case 'work': return 'Trabajo';
      case 'personal': return 'Personal';
      case 'meeting': return 'Reunión';
      case 'reminder': return 'Recordatorio';
      default: return 'Otro';
    }
  };

  const goToPrevious = () => {
    if (viewMode === 'month') {
      setSelectedDate(subMonths(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(subWeeks(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, -1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setSelectedDate(addMonths(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(addWeeks(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={viewMode === 'month' ? 'Mes anterior' : viewMode === 'week' ? 'Semana anterior' : 'Día anterior'}
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 min-w-[180px] text-center capitalize">
              {viewMode === 'month'
                ? format(selectedDate, 'MMMM yyyy', { locale: es })
                : viewMode === 'week'
                ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}`
                : format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
            </h3>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={viewMode === 'month' ? 'Mes siguiente' : viewMode === 'week' ? 'Semana siguiente' : 'Día siguiente'}
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Hoy
          </button>
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewMode === 'month' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vista mensual"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">Mes</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewMode === 'week' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vista semanal"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden md:inline">Semana</span>
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewMode === 'day' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vista diaria"
            >
              <List className="w-4 h-4" />
              <span className="hidden md:inline">Día</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setTypeFilter(typeFilter === 'all' ? 'work' : 'all')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Filtrar por tipo"
            >
              <Filter className={`w-5 h-5 ${typeFilter !== 'all' ? 'text-brand-navy' : 'text-gray-600'}`} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Buscar eventos"
            >
              <Search className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <p className="text-sm text-gray-600 hidden md:block">
            {todayEvents.length} {todayEvents.length === 1 ? 'evento' : 'eventos'} hoy
          </p>
          <button
            onClick={() => {
              setFormData({
                title: '',
                description: '',
                type: 'work',
                startDate: format(selectedDate, 'yyyy-MM-dd'),
                startTime: '09:00',
                endDate: format(selectedDate, 'yyyy-MM-dd'),
                endTime: '10:00',
                location: '',
                category: 'general',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-brand-navy text-white px-3 md:px-4 py-2 rounded-lg hover:bg-[#1a1870] transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, descripción o ubicación..."
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              autoFocus
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
            >
              <option value="all">Todos los tipos</option>
              <option value="work">Trabajo</option>
              <option value="personal">Personal</option>
              <option value="meeting">Reunión</option>
              <option value="reminder">Recordatorio</option>
              <option value="other">Otro</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
            >
              <option value="date">Ordenar por fecha</option>
              <option value="title">Ordenar por título</option>
              <option value="type">Ordenar por tipo</option>
            </select>
            {(searchQuery || typeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-2">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
            </p>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Total</p>
          <p className="text-xl font-bold text-gray-900">{events.length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Hoy</p>
          <p className="text-xl font-bold text-brand-navy">{todayEvents.length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Pasados</p>
          <p className="text-xl font-bold text-gray-600">{events.filter(e => isPast(e.endDate) && !isToday(e.endDate)).length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Próximos</p>
          <p className="text-xl font-bold text-green-600">{events.filter(e => isFuture(e.startDate)).length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Esta semana</p>
          <p className="text-xl font-bold text-brand-navy">
            {events.filter(e => {
              const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
              const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
              return e.startDate >= weekStart && e.startDate <= weekEnd;
            }).length}
          </p>
        </div>
      </div>

      {/* Calendar Grid - Monthly View */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="text-center text-xs md:text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {/* Empty cells for days before month start */}
            {Array.from({ length: (daysInMonth[0]?.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-16 md:min-h-24 p-1 md:p-2 bg-gray-50 rounded-lg opacity-50" />
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isDayToday = isToday(day);
              const isDayPast = isPast(day) && !isDayToday;
              return (
                <div
                  key={day.toString()}
                  className={`min-h-16 md:min-h-24 p-1 md:p-2 border rounded-lg ${
                    isDayToday ? 'bg-brand-blue/10 border-brand-navy ring-2 ring-brand-blue/30' : 
                    isDayPast ? 'bg-gray-50 border-gray-200 opacity-70' :
                    'bg-white border-gray-200'
                  } hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer`}
                  onClick={() => {
                    setSelectedDate(day);
                    setViewMode('day');
                  }}
                >
                  <div className={`text-xs md:text-sm font-medium ${isDayToday ? 'text-brand-navy font-bold' : isDayPast ? 'text-gray-400' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded truncate border-l-2 ${getEventTypeColor(event.type)}`}
                        title={`${event.title} - ${format(event.startDate, 'HH:mm')}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEventDetail(event);
                        }}
                      >
                        <span className="hidden md:inline">{format(event.startDate, 'HH:mm')} </span>
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 2} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Grid - Weekly View */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {daysInWeek.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isDayToday = isToday(day);
              const isDayPast = isPast(day) && !isDayToday;
              return (
                <div key={day.toString()} className="min-h-[300px] md:min-h-[400px]">
                  <div
                    className={`text-center p-2 rounded-t-lg cursor-pointer ${
                      isDayToday ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedDate(day);
                      setViewMode('day');
                    }}
                  >
                    <div className="text-xs font-medium uppercase">
                      {format(day, 'EEE', { locale: es })}
                    </div>
                    <div className="text-lg md:text-xl font-bold">{format(day, 'd')}</div>
                  </div>
                  <div className={`border border-t-0 ${isDayPast ? 'border-gray-200 bg-gray-50' : 'border-gray-200'} rounded-b-lg p-2 space-y-2 min-h-[270px] md:min-h-[350px]`}>
                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center mt-4">Sin eventos</p>
                    ) : (
                      dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`p-2 border-l-4 rounded-r text-xs md:text-sm cursor-pointer hover:shadow transition-all ${getEventTypeColor(event.type)}`}
                          onClick={() => setShowEventDetail(event)}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-xs opacity-80 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
                          </div>
                          {event.location && (
                            <div className="text-xs opacity-70 mt-1 truncate">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {event.location}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4 pb-4 border-b">
            <h4 className="text-lg font-semibold text-gray-900">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {getEventsForDay(selectedDate).length} {getEventsForDay(selectedDate).length === 1 ? 'evento' : 'eventos'}
            </p>
          </div>
          {loading ? (
            <p className="text-gray-500 text-center py-8">Cargando...</p>
          ) : getEventsForDay(selectedDate).length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No hay eventos programados para este día</p>
              <button
                onClick={() => {
                  setFormData({
                    title: '',
                    description: '',
                    type: 'work',
                    startDate: format(selectedDate, 'yyyy-MM-dd'),
                    startTime: '09:00',
                    endDate: format(selectedDate, 'yyyy-MM-dd'),
                    endTime: '10:00',
                    location: '',
                    category: 'general',
                  });
                  setShowModal(true);
                }}
                className="text-brand-navy hover:text-brand-blue text-sm font-medium"
              >
                + Crear evento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {getEventsForDay(selectedDate)
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 border-l-4 rounded-r cursor-pointer hover:shadow-md transition-all ${getEventTypeColor(event.type)}`}
                    onClick={() => setShowEventDetail(event)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                            {getEventTypeName(event.type)}
                          </span>
                          <span className="text-sm font-medium">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
                          </span>
                        </div>
                        <h5 className="font-bold text-lg mb-2">{event.title}</h5>
                        {event.description && (
                          <p className="text-sm opacity-90 mb-2">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="text-sm opacity-80">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            {event.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(event);
                          }}
                          className="p-2 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(event.id);
                          }}
                          className="p-2 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {showEventDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${getEventTypeColor(showEventDetail.type)}`}>
                    {getEventTypeName(showEventDetail.type)}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{showEventDetail.title}</h3>
              </div>
              <button onClick={() => setShowEventDetail(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-gray-700">
                <Clock className="w-5 h-5 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium">
                    {format(showEventDetail.startDate, 'EEEE, d MMMM yyyy', { locale: es })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(showEventDetail.startDate, 'HH:mm')} - {format(showEventDetail.endDate, 'HH:mm')}
                  </p>
                </div>
              </div>

              {showEventDetail.description && (
                <div className="flex items-start gap-3 text-gray-700">
                  <List className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="font-medium mb-1">Descripción</p>
                    <p className="text-sm text-gray-600">{showEventDetail.description}</p>
                  </div>
                </div>
              )}

              {showEventDetail.location && (
                <div className="flex items-start gap-3 text-gray-700">
                  <MapPin className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="font-medium mb-1">Ubicación</p>
                    <p className="text-sm text-gray-600">{showEventDetail.location}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 text-gray-700">
                <CalendarIcon className="w-5 h-5 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium mb-1">Categoría</p>
                  <p className="text-sm text-gray-600">{showEventDetail.category}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t">
              <button
                onClick={() => {
                  handleEdit(showEventDetail);
                  setShowEventDetail(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  setShowEventDetail(null);
                  handleDelete(showEventDetail.id);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EventType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                >
                  <option value="work">Trabajo</option>
                  <option value="personal">Personal</option>
                  <option value="meeting">Reunión</option>
                  <option value="reminder">Recordatorio</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors font-medium"
                >
                  {editingEvent ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
