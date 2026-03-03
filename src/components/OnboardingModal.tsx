'use client';

import { useState } from 'react';
import { Sparkles, Calendar, CheckSquare, Wallet, MessageSquare, ArrowRight, X } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

const steps = [
  {
    icon: Sparkles,
    title: '¡Bienvenido a Lilly AI!',
    description: 'Tu asistente personal inteligente que te ayuda a organizar tu vida, gestionar tus finanzas y ser más productivo.',
    color: 'bg-brand-navy',
  },
  {
    icon: Calendar,
    title: 'Gestión de Agenda',
    description: 'Crea eventos, reuniones y recordatorios. Lilly puede organizar tu calendario por ti con un simple mensaje.',
    color: 'bg-brand-blue',
  },
  {
    icon: CheckSquare,
    title: 'Tareas y Productividad',
    description: 'Gestiona tus tareas con prioridades y fechas. Lilly analiza tu productividad y te da recomendaciones.',
    color: 'bg-green-600',
  },
  {
    icon: Wallet,
    title: 'Control Financiero',
    description: 'Registra ingresos y gastos, crea presupuestos y visualiza tus finanzas. Dile a Lilly "gasté 500 en comida" y listo.',
    color: 'bg-brand-orange',
  },
  {
    icon: MessageSquare,
    title: 'Habla con Lilly',
    description: 'Usa texto o voz para interactuar. Lilly recuerda tus preferencias y aprende de tus hábitos para asistirte mejor.',
    color: 'bg-purple-600',
  },
];

interface OnboardingModalProps {
  onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    hapticLight();
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Bienvenida">
      <div className="bg-white dark:bg-surface rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
        {/* Skip button */}
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={onComplete}
            className="text-xs text-gray-400 dark:text-text-tertiary hover:text-gray-600 flex items-center gap-1 transition-colors"
            aria-label="Omitir introducción"
          >
            Omitir <X className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-2 text-center">
          <div className={`w-16 h-16 mx-auto mb-4 ${step.color} rounded-2xl flex items-center justify-center shadow-lg animate-fade-in`} key={currentStep}>
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-foreground mb-2 animate-fade-in" key={`title-${currentStep}`}>
            {step.title}
          </h2>
          <p className="text-sm text-gray-600 dark:text-text-secondary leading-relaxed animate-fade-in" key={`desc-${currentStep}`}>
            {step.description}
          </p>
        </div>

        {/* Progress + Action */}
        <div className="px-8 pb-8 pt-4">
          {/* Dots */}
          <div className="flex justify-center gap-1.5 mb-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-brand-navy dark:bg-brand-blue' : 'w-1.5 bg-gray-200 dark:bg-border-custom hover:bg-gray-300'
                }`}
                aria-label={`Paso ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="w-full bg-brand-navy dark:bg-brand-blue text-white dark:text-brand-navy font-semibold py-3 rounded-xl transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLastStep ? '¡Empezar!' : 'Siguiente'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
