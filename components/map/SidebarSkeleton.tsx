import { X } from 'lucide-react';

/** Placeholder shown in the department sidebar while its forecast loads. */
export default function SidebarSkeleton({ deptName, deptCode, onClose }: { deptName: string; deptCode: number; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col" role="status" aria-label={`Loading forecast for ${deptName}`}>
      <div className="flex items-start justify-between p-5 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">{deptName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{String(deptCode).padStart(2, '0')}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-muted-foreground cursor-pointer">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 p-5 space-y-5">
        <div className="skeleton h-14 rounded-xl w-full" />
        <div className="space-y-2">
          <div className="skeleton h-4 rounded w-32" />
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 rounded w-44" />
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-6 rounded w-full" />)}
        </div>
      </div>
    </div>
  );
}
