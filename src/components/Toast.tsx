interface ToastProps {
  message: string;
  tone?: 'success' | 'error' | 'info';
}

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-slate-200 bg-white text-slate-700',
};

export default function Toast({ message, tone = 'info' }: ToastProps) {
  return (
    <div className={`toast-slide rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${toneClasses[tone]}`}>
      {message}
    </div>
  );
}
