// ─────────────────────────────────────────────
// Helpers compartidos del módulo de cultura (empleado)
// ─────────────────────────────────────────────

import {
  BookOpen, Target, Users, ClipboardList, Trophy,
} from 'lucide-react'
import type { BloqueKey, Pregunta } from './types'

// ─────────────────────────────────────────────
// Configuración de bloques
// ─────────────────────────────────────────────

export const BLOQUES_ORDEN: BloqueKey[] = [
  'historia',
  'mision',
  'como_trabajamos',
  'expectativas',
  'hitos',
]

export const BLOQUES_CONFIG: Record<BloqueKey, {
  label: string
  icon: React.ReactNode
  iconBg: string
  iconText: string
  accent: string
}> = {
  historia: {
    label: 'Nuestra historia',
    icon: <BookOpen className="w-5 h-5" />,
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    accent: 'border-sky-200',
  },
  mision: {
    label: 'Misión, visión y valores',
    icon: <Target className="w-5 h-5" />,
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    accent: 'border-teal-200',
  },
  como_trabajamos: {
    label: 'Cómo trabajamos',
    icon: <Users className="w-5 h-5" />,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    accent: 'border-blue-200',
  },
  expectativas: {
    label: 'Cultura en el día a día',
    icon: <ClipboardList className="w-5 h-5" />,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    accent: 'border-amber-200',
  },
  hitos: {
    label: 'Nuestros hitos',
    icon: <Trophy className="w-5 h-5" />,
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    accent: 'border-rose-200',
  },
}

// ─────────────────────────────────────────────
// Preguntas
// ─────────────────────────────────────────────

export const PREGUNTAS: Record<BloqueKey, Pregunta[]> = {
  historia: [
    {
      pregunta: '¿Qué suelen reflejar los orígenes de una empresa?',
      opciones: [
        'Sus valores fundacionales y propósito inicial',
        'El número exacto de empleados en su fundación',
        'Los productos que ya no vende',
        'Solo datos financieros históricos',
      ],
      correcta: 0,
    },
    {
      pregunta: '¿Por qué es valioso conocer la historia de tu empresa?',
      opciones: [
        'Para memorizar fechas exactas en entrevistas',
        'Para entender el ADN y la cultura que moldea el presente',
        'No es realmente relevante para el trabajo diario',
        'Solo es útil en reuniones con clientes',
      ],
      correcta: 1,
    },
  ],
  mision: [
    {
      pregunta: '¿Cuál es la diferencia entre misión y visión?',
      opciones: [
        'Son sinónimos, significan lo mismo',
        'La misión describe el propósito presente; la visión, la aspiración futura',
        'La misión describe el futuro y la visión el pasado',
        'La visión describe lo que hacemos hoy',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Para qué sirven los valores en una empresa?',
      opciones: [
        'Solo para el sitio web y materiales de marketing',
        'Para decorar las paredes de la oficina',
        'Para guiar decisiones y definir comportamientos esperados',
        'Son aspiracionales, no tienen impacto real',
      ],
      correcta: 2,
    },
  ],
  como_trabajamos: [
    {
      pregunta: '¿Qué define principalmente la cultura de trabajo de un equipo?',
      opciones: [
        'Los horarios de entrada y salida',
        'Las normas, valores y comportamientos compartidos en el día a día',
        'Solo los procesos documentados en un manual',
        'El software y las herramientas que usan',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Cuál es el beneficio de tener acuerdos de trabajo claros?',
      opciones: [
        'Reducen la necesidad de comunicarse',
        'Solo son útiles para empleados nuevos',
        'Alinean expectativas y reducen fricciones innecesarias',
        'Aumentan la burocracia del equipo',
      ],
      correcta: 2,
    },
  ],
  expectativas: [
    {
      pregunta: '¿Por qué es útil conocer las expectativas de tu rol desde el día 1?',
      opciones: [
        'Para saber exactamente qué no hacer',
        'Porque así podés alinear tu esfuerzo con lo que realmente importa',
        'No es tan importante en los primeros meses',
        'Solo para los roles de liderazgo',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Qué facilita tener objetivos claros en un nuevo trabajo?',
      opciones: [
        'Trabajar más horas que los demás',
        'Evitar reuniones de seguimiento',
        'Priorizar bien y medir tu propio progreso',
        'Delegar más tareas a otros',
      ],
      correcta: 2,
    },
  ],
  hitos: [
    {
      pregunta: '¿Qué representan los hitos en la historia de una empresa?',
      opciones: [
        'Solo los problemas que se tuvieron que superar',
        'Momentos clave que marcaron el crecimiento y la evolución',
        'Únicamente cambios de nombre o logo',
        'Solo los logros financieros anuales',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Por qué es importante celebrar logros colectivos?',
      opciones: [
        'Para justificar gastos de fin de año',
        'No tiene impacto real en el equipo',
        'Refuerza el sentido de pertenencia y reconoce el esfuerzo compartido',
        'Solo sirve para comunicados externos',
      ],
      correcta: 2,
    },
  ],
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

export const blockVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

export const quizVariants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 },
  },
}
