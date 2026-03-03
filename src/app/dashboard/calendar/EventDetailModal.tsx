'use client';

import { Event, EventType } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Clock, List, MapPin, Calendar as CalendarIcon, Edit2, Trash2 } from 'lucide-react';

interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  getEventTypeColor: (type: EventType) => string;
  getEventTypeName: (type: EventType) => string;
}

export default function EventDetailModal({
  event,
  onClose,
  onEdit,
  onDelete,
  getEventTypeColor,
  getEventTypeName,
}: EventDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded ${getEventTypeColor(event.type)}`}>
                {getEventTypeName(event.type)}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{event.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-gray-700">
            <Clock className="w-5 h-5 mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium">
                {format(event.startDate, 'EEEE, d MMMM yyyy', { locale: es })}
              </p>
              <p className="text-sm text-gray-600">
                {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
              </p>
            </div>
          </div>

          {event.description && (
            <div className="flex items-start gap-3 text-gray-700">
              <List className="w-5 h-5 mt-0.5 text-gray-400" />
              <div>
                <p className="font-medium mb-1">Descripción</p>
                <p className="text-sm text-gray-600">{event.description}</p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="w-5 h-5 mt-0.5 text-gray-400" />
              <div>
                <p className="font-medium mb-1">Ubicación</p>
                <p className="text-sm text-gray-600">{event.location}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 text-gray-700">
            <CalendarIcon className="w-5 h-5 mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium mb-1">Categoría</p>
              <p className="text-sm text-gray-600">{event.category}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t">
          <button
            onClick={() => {
              onEdit(event);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => {
              onClose();
              onDelete(event.id);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
