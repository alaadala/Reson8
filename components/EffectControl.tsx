import React from 'react';

interface EffectControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
  disabled?: boolean;
}

const EffectControl: React.FC<EffectControlProps> = ({ 
  label, value, min, max, step, unit = '', onChange, disabled 
}) => {
  return (
    <div className="flex flex-col gap-2 mb-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-300 tracking-wide uppercase">{label}</label>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  );
};

export default EffectControl;